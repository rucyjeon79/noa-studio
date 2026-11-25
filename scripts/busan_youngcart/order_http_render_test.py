"""HTTP smoke test for the actual staged PHP theme, against isolated MariaDB.
The synthetic common.php never leaves the temporary document root.
The production purchase gate remains closed.
"""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode
import os
import re
import socket
import subprocess
import tempfile
import time
from order_theme_package_test import stage

COMMON=r"""<?php
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture'){http_response_code(503);exit;}
session_start();
define('_GNUBOARD_',true);
define('G5_URL','http://127.0.0.1:'.$_SERVER['SERVER_PORT']);
define('G5_BBS_URL',G5_URL.'/bbs');
define('G5_PATH',__DIR__);
function add_stylesheet($tag,$priority){$GLOBALS['fixture_css'][]=$tag;}
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')exit;
$role=$_SERVER['HTTP_X_FIXTURE_ROLE']??'guest';
$is_member=in_array($role,['member','super','blocked'],true);
$is_admin=$role==='super'?'super':'';
$member=['mb_id'=>'api_alice','mb_point'=>1000,'mb_leave_date'=>'','mb_intercept_date'=>$role==='blocked'?'20261125':''];
$g5=[];
function sql_query($sql,$show=true){
    if(!preg_match('/^\s*SELECT\b/i',$sql))throw new RuntimeException('HTTP fixture reads only');
    return $GLOBALS['db']->query($sql);
}
function sql_fetch_array($r){return $r->fetch(PDO::FETCH_ASSOC);}
function sql_real_escape_string($v){return substr($GLOBALS['db']->quote($v),1,-1);}
function get_session($key){return $_SESSION[$key]??null;}
function set_session($key,$v){$_SESSION[$key]=$v;}
function alert($message,$url){http_response_code(403);exit;}
"""
def check(value,label):
    if not value:raise RuntimeError(label)
def run():
    if os.environ.get("BUSAN_FIXTURE_DB")!="pointzone_fixture":raise RuntimeError("fixture only")
    with tempfile.TemporaryDirectory(prefix="bpz-http-") as tmp:
        root=Path(tmp)
        (root/"theme").mkdir()
        stage(root/"theme"/"Busan_PointZone")
        (root/"common.php").write_text(COMMON)
        (root/"head.php").write_text("""<!doctype html><html><head><?php echo implode('', $GLOBALS['fixture_css']??[]); ?></head><body><header id="native-site-header">부산지부 ON</header><nav id="native-site-menu">기존 메뉴</nav><main id="contentsWrap">""")
        (root/"tail.php").write_text("""</main><footer id="native-site-footer">부산지부 ON</footer></body></html>""")
        with socket.socket() as s:
            s.bind(("127.0.0.1",0));port=s.getsockname()[1]
        with (root/"server.log").open("w+") as log:
            proc=subprocess.Popen(["php","-S",f"127.0.0.1:{port}","-t",str(root)],stdout=log,stderr=log)
            base=f"http://127.0.0.1:{port}/theme/Busan_PointZone/"
            def call(path,role="member",data=None):
                req=Request(base+path,headers={"X-Fixture-Role":role},data=urlencode(data).encode() if data is not None else None)
                try:
                    with urlopen(req,timeout=5) as r:return r.status,r.read().decode(),r.headers
                except HTTPError as e:return e.code,e.read().decode(),e.headers
            try:
                for _ in range(50):
                    try:call("checkout.php","guest");break
                    except OSError:time.sleep(.1)
                else:raise RuntimeError("HTTP server unavailable")
                for role in ("guest","blocked"):
                    check(call("checkout.php",role)[0]==403,"unauthorized checkout")
                    check(call("pointzone.php?section=my",role)[0]==403,"unauthorized order history")
                code,body,headers=call("pointzone.php?section=shop")
                check(code==200 and "상품 및 구매 안내" in body and "API fixture" in body,"real catalog render")
                check("private" in headers.get("Cache-Control",""),"private cache")
                def integrated(html):
                    check(html.count("<html")==1 and html.count("</html>")==1,"single native document")
                    check(html.index('id="native-site-header"')<html.index('id="native-site-menu"')<html.index('id="contentsWrap"')<html.index('id="busan-pointzone"')<html.index('id="native-site-footer"'),"shared native layout order")
                    check("pointzone.css?v=" in html and "bpz-header" not in html,"scoped stylesheet and no duplicate header")
                integrated(body)
                code,body,_=call("checkout.php?item="+"8"*20)
                check(code==200 and "장바구니 담기" in body and "<fieldset disabled>" in body,"disabled product action")
                check("결제 확인 대기 주문" not in body,"member must not see admin UI")
                integrated(body)
                code,body,_=call("pointzone.php?section=my")
                check(code==200 and "123456789012397" in body and "123456789012396" not in body,"member history isolated")
                check(call("pointzone.php?section=manage")[0]==404,"admin page denied")
                code,body,_=call("checkout.php","super")
                check(code==200 and "결제 확인 대기 주문" in body and "주문 상태 복구" in body,"admin UI")
                integrated(body)
                code,body,_=call("catalog-admin.php","super")
                check(code==200,"catalog admin render")
                integrated(body)
                check(call("pointzone.php?section=manage","super")[0]==200,"admin order page")
                for role in ("member","super"):
                    for action in ("purchase","cancel","cart_set","cart_remove","review_pending","finish_pending"):
                        code,_,_=call("checkout.php",role,{"action":action,"csrf":"fake","enabled":"1"})
                        check(code==503,"server-side purchase gate")
                check(call("checkout.php?enabled=1")[0]==200,"query cannot enable purchase")
                log.flush();log.seek(0)
                check(not re.search(r"PHP (Fatal error|Warning|Parse error|Notice)",log.read()),"HTTP PHP runtime warnings")
                print("BUSAN_POINTZONE_HTTP_RENDER_AND_LOCK_OK")
                print("BUSAN_POINTZONE_SHARED_LAYOUT_OK")
            finally:
                proc.terminate();proc.wait(timeout=5)
if __name__=="__main__":run()

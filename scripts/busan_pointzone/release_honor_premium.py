"""Deploy premium honor UI only; isolated authenticated render before live upload."""
import hmac,tempfile,subprocess,shutil,json
from pathlib import Path
from urllib.request import Request,urlopen
import release_submenu_fix as remote
from release_native_catalog_admin import lint,response
BASE=Path('deploy/busan/youngcart/theme/Busan_PointZone')
FILES={'css/honor.css':None,'honor.php':'dd54730e33b945e728a5a8767c9a1c7e074c612b'}
def fixture():
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);theme=root/'theme/Busan_PointZone';theme.mkdir(parents=True)
        for rel in ('honor.php','css/honor.css','css/pointzone.css','shop/shop.head.php','shop/shop.tail.php'):
            dest=theme/rel;dest.parent.mkdir(exist_ok=True);shutil.copyfile(BASE/rel,dest)
        (root/'common.php').write_text("""<?php
define('_GNUBOARD_',true);define('G5_PATH',__DIR__);define('G5_URL','https://fixture.invalid');define('G5_BBS_URL',G5_URL.'/bbs');
$is_member=true;$member=['mb_id'=>'fixture','mb_level'=>(int)getenv('BH_LEVEL'),'mb_leave_date'=>'','mb_intercept_date'=>''];$g5=[];
function add_stylesheet($s,$n){$GLOBALS['styles'][]=$s;}
function alert($s,$u){throw new RuntimeException('unexpected authentication failure');}
$_GET=['section'=>getenv('BH_SECTION')];$_SERVER['REQUEST_METHOD']='GET';
""")
        (root/'head.php').write_text("<?php echo '<!doctype html><html><head>'.implode('', $GLOBALS['styles']??[]).'</head><body><main>'; ?>")
        (root/'tail.php').write_text('</main></body></html>')
        for section in ('home','rules','review','vote','history'):
            for level in ('2','4'):
                env=dict(remote.os.environ,BH_SECTION=section,BH_LEVEL=level)
                p=subprocess.run(['php',str(theme/'honor.php')],env=env,capture_output=True,text=True,check=True)
                if p.stderr or 'id="bhof"' not in p.stdout or 'honor.css?v=' not in p.stdout:raise RuntimeError('fixture render failed '+section)
                if section=='home' and any(x not in p.stdout for x in ('FIRST HONOREE','+1,000P','명예 배지 컬렉션','첫 번째 수상자를 기다립니다.')):raise RuntimeError('home content missing')
                if section=='review' and level=='2' and '간부 전용 심사 공간' not in p.stdout:raise RuntimeError('staff restriction missing')
                if section=='review' and level=='4' and '현재 진행 중인 심사가 없습니다.' not in p.stdout:raise RuntimeError('staff view missing')
        css=(theme/'css/honor.css').read_text()
        if '@media(max-width:560px)' not in css or '#bhof' not in css:raise RuntimeError('responsive stylesheet missing')
        print('BUSAN_HONOR_PREMIUM_FIXTURE_OK',{'member_render_cases':10,'responsive_css':True,'visual_browser':'unverified'},flush=True)
def release(s):
    for path in (remote.ROOT,remote.THEME,remote.THEME+'/css',remote.PRIVATE):remote.directory(s,path)
    plan=[]
    for rel,expected in FILES.items():
        new=(BASE/rel).read_bytes()
        if rel.endswith('.php'):lint(new)
        target=remote.THEME+'/'+rel;old=remote.read(s,target,200000)
        if old==new:continue
        if remote.blob(old)!=expected:raise RuntimeError('live version conflict: '+rel)
        if old is not None:
            backup=remote.PRIVATE+'/pointzone-honor-premium-'+remote.digest(old)+'.bak'
            if remote.read(s,backup,200000) is None:remote.write(s,backup,old,0o600)
            if remote.read(s,backup,200000)!=old:raise RuntimeError('backup verification failed')
        plan.append((target,old,new))
    changed=[]
    try:
        for target,old,new in plan:
            if remote.read(s,target,200000)!=old:raise RuntimeError('concurrent edit')
            changed.append((target,old,new));remote.write(s,target,new,0o644)
            if remote.read(s,target,200000)!=new:raise RuntimeError('readback failed')
        css_url='https://skhnslu-busan.com/theme/Busan_PointZone/css/honor.css?v='+remote.digest((BASE/'css/honor.css').read_bytes())[:12]
        with urlopen(Request(css_url,headers={'Cache-Control':'no-cache'}),timeout=20) as r:
            if r.read(200000)!=(BASE/'css/honor.css').read_bytes():raise RuntimeError('public CSS mismatch')
        for path in ('','theme/Busan_PointZone/honor.php','theme/Busan_PointZone/honor.php?section=rules','theme/Busan_PointZone/honor.php?section=review','theme/Busan_PointZone/honor.php?section=vote','theme/Busan_PointZone/honor.php?section=history','theme/Busan_PointZone/pointzone.php?section=shop'):
            status,body,url=response(path)
            if status>=500 or 'Fatal error' in body:raise RuntimeError('route error '+path)
            print('BUSAN_HONOR_PREMIUM_ROUTE',path or '/',status,'login' if 'login.php' in url or '로그인' in body else 'other',flush=True)
        print('BUSAN_HONOR_PREMIUM_LIVE_OK',{'files_changed':len(changed),'css_verified':True,'member_render':'fixture_only','menu_mutations':0,'point_mutations':0,'voting':'not_enabled'},flush=True)
    except Exception:
        for target,old,new in reversed(changed):
            if remote.read(s,target,200000)!=new:raise RuntimeError('rollback conflict')
            if old is None:s.remove(target)
            else:remote.write(s,target,old,0o644)
        raise
if __name__=='__main__':
    fixture()
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);release(s)

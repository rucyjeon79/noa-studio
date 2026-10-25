"""Isolated native SQL + PHP browser fixture. Never deployed."""
from pathlib import Path
import shutil,subprocess
root=Path('/tmp/noa-subscription-site');root.mkdir(exist_ok=True)
shutil.copytree('bridge',root/'noa-bridge',dirs_exist_ok=True)
shutil.copytree('deploy',root,dirs_exist_ok=True,ignore=shutil.ignore_patterns('noastudio'))
(root/'extend').mkdir(exist_ok=True);shutil.copy('deploy/noa-access.extend.php',root/'extend/noa.access.php')
bootstrap=Path('tests/subscription/native_fixture.php').read_text().replace("require_once __DIR__.'/../../bridge/subscription-core.php';",'')
(root/'common.php').write_text(bootstrap+'''
session_start();$name=$_COOKIE['qa_owner']??'ui_390_noa-studio';$is_admin=($_COOKIE['qa_admin']??'')==='1'?'super':'';
if($is_admin==='super')$member=['mb_id'=>'qa_admin','mb_level'=>10,'mb_point'=>0];else{$r=sql_query("SELECT * FROM g5_member WHERE mb_id='".mysqli_real_escape_string($g5['connect_db'],$name)."'");$member=sql_fetch_array($r)?:[];}
$is_member=!empty($member);$member['mb_nick']='테스트 회원';
function get_text($s){return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
require __DIR__.'/extend/noa.access.php';
''')
(root/'bbs').mkdir(exist_ok=True);(root/'bbs/login.php').write_text("<?php require dirname(__DIR__).'/common.php';echo '<!doctype html><html><head></head><body>로그인</body></html>';")
code="require 'tests/subscription/native_fixture.php';"
for theme in ['noa-studio','noa-ivory']:
 for width in [360,390,430]:
  name=f'ui_{width}_{theme}';code+=f"ns_q('INSERT INTO g5_member VALUES('+ns_e('{name}')+',3,0)');insert_point('{name}',100,'fixture','fixture','{name}','seed');"
code+="echo 'SUBSCRIPTION_BROWSER_FIXTURE_READY';"
subprocess.run(['php','-r',code],check=True)

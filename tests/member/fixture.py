"""Isolated CI fixture, never mapped to production. No real member accounts."""
from pathlib import Path
import shutil,os
root=Path('/tmp/noa-member-site');root.mkdir(exist_ok=True)
shutil.copytree('bridge',root/'noa-bridge',dirs_exist_ok=True)
shutil.copytree('deploy',root,dirs_exist_ok=True,ignore=shutil.ignore_patterns('noastudio'))
(root/'extend').mkdir(exist_ok=True)
shutil.copy('deploy/noa-access.extend.php',root/'extend/noa.access.php')
(root/'common.php').write_text('''<?php
if(defined('_GNUBOARD_'))return;define('_GNUBOARD_',true);session_start();
$level=(int)($_COOKIE['qa_level']??1);$owner=($_COOKIE['qa_owner']??'a')==='b'?'qa_owner_b':'qa_owner_a';
$member=$level>1?['mb_id'=>$owner,'mb_level'=>$level,'mb_nick'=>'테스트 회원']:[];$is_member=$level>1;$is_admin='';$config=[];
function get_text($s){return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
require __DIR__.'/extend/noa.access.php';
''')
(root/'index.php').write_text("<?php require __DIR__.'/common.php';require __DIR__.'/noa-app/home.php';")
(root/'bbs').mkdir(exist_ok=True)
for name in ['board','write','write_update','write_comment_update','login']:
 (root/'bbs'/f'{name}.php').write_text("<?php require dirname(__DIR__).'/common.php';echo '<!doctype html><html><head></head><body>native fixture</body></html>';")
print('ISOLATED_MEMBER_FIXTURE_READY')

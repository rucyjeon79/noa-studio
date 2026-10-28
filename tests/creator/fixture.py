from pathlib import Path
import shutil
root=Path('/tmp/noa-creator-site');root.mkdir(exist_ok=True)
shutil.copytree('bridge',root/'noa-bridge',dirs_exist_ok=True)
shutil.copytree('deploy',root,dirs_exist_ok=True,ignore=shutil.ignore_patterns('noastudio'))
(root/'common.php').write_text('''<?php
if(defined('_GNUBOARD_'))return;define('_GNUBOARD_',true);define('G5_PATH',__DIR__);session_start();
require_once __DIR__.'/noa-bridge/storage.php';$fixtureDb=noa_bridge_pdo();$fixtureDb->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
$owner=$_COOKIE['qa_owner']??'';$allowed=['qa_owner_a','qa_two','qa_three','qa_four','qa_five','qa_six'];$q=$fixtureDb->prepare('SELECT * FROM g5_member WHERE mb_id=?');$q->execute([in_array($owner,$allowed,true)?$owner:'']);$member=$q->fetch(PDO::FETCH_ASSOC)?:[];$is_member=!empty($member['mb_id']);$is_admin=$owner==='qa_owner_a'?'super':'';
$config=['cf_admin'=>'qa_owner_a','cf_cert_use'=>0,'cf_use_email_certify'=>0];$g5=['member_table'=>'g5_member','board_table'=>'g5_board','write_prefix'=>'g5_write_','group_table'=>'g5_group'];
function get_text($s){return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
function sql_query($q,$error=true){return $GLOBALS['fixtureDb']->query($q);}function sql_fetch_array($q){return $q->fetch(PDO::FETCH_ASSOC);}function sql_fetch($q){return sql_fetch_array(sql_query($q))?:[];}function sql_escape_string($v){return substr($GLOBALS['fixtureDb']->quote($v),1,-1);}
function hyphen_hp_number($v){$v=preg_replace('/[^0-9]/','',$v);return preg_replace('/^(01[0-9])([0-9]{3,4})([0-9]{4})$/','$1-$2-$3',$v);}function get_encrypt_string($v){return password_hash($v,PASSWORD_DEFAULT);}
require __DIR__.'/noa-access.extend.php';require __DIR__.'/noa-creator-membership.extend.php';
ob_start(static fn($html)=>str_replace('</head>','<link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-notifications.css"></head>',$html));

'''.replace("require __DIR__.'/noa-creator-membership.extend.php';","require __DIR__.'/extend/noa.creator-membership.php';").replace("require __DIR__.'/noa-access.extend.php';","require __DIR__.'/extend/noa.access.php';"))
(root/'extend').mkdir(exist_ok=True)
shutil.copy('deploy/noa-access.extend.php',root/'extend/noa.access.php');shutil.copy('deploy/noa-creator-membership.extend.php',root/'extend/noa.creator-membership.php')
(root/'js').mkdir(exist_ok=True)
(root/'js/jquery-1.12.4.min.js').write_text('');(root/'js/certify.js').write_text('')
print('CREATOR_FIXTURE_READY')

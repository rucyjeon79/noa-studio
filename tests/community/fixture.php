<?php
declare(strict_types=1);
/** Disposable CI database/site. Never installed or addressed as a production login mechanism. */
$root='/tmp/noa-community-fixture';@mkdir($root,0700,true);foreach(['noa-bridge','extend','bbs','noa-app']as $dir)@mkdir($root.'/'.$dir,0700,true);
$common= <<<'PHP'
<?php
if(defined('_GNUBOARD_'))return;define('_GNUBOARD_',true);define('G5_TIME_YMDHIS',date('Y-m-d H:i:s'));define('G5_BBS_PATH',__DIR__.'/bbs');session_start();
$role=$_COOKIE['qa_role']??'guest';$member=$role==='guest'?[]:['mb_id'=>'qa_'.$role,'mb_level'=>$role==='admin'||$role==='staff'?10:($role==='temp'?2:4),'mb_nick'=>$role==='admin'?'관리자':'작성자 '.$role];$is_admin=$role==='admin'?'super':'';$config=[];$is_member=!!$member;
$g5=['board_table'=>'g5_board','group_table'=>'g5_group','write_prefix'=>'g5_write_','board_new_table'=>'g5_board_new'];
$nc_db=new mysqli('127.0.0.1','root','fixture-only','noa_community',3306);$nc_db->set_charset('utf8mb4');$nc_db->query("SET SESSION sql_mode=''");
function sql_query($q,$error=true){global $nc_db;try{return $nc_db->query($q);}catch(Throwable $e){if($error)throw $e;return false;}}
function sql_fetch_array($r){return $r->fetch_assoc();}function sql_insert_id(){global $nc_db;return $nc_db->insert_id;}function sql_escape_string($s){global $nc_db;return $nc_db->real_escape_string($s);}
function get_encrypt_string($s){return password_hash($s,PASSWORD_DEFAULT);}function check_password($s,$h){return password_verify($s,$h);}
function add_event($name,$fn,$priority=10,$args=0){if($name==='common_header')$fn();}function add_replace(...$args){}function add_stylesheet(...$args){}function add_javascript(...$args){}
$bo_table=(string)($_GET['bo_table']??$_POST['bo_table']??'');require __DIR__.'/extend/noa.01-community.php';
// Local browser test origin represents this isolated same-origin site only.
if(($_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8076')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';
require __DIR__.'/extend/noa.design.php';
PHP;
file_put_contents($root.'/common.php',$common);
foreach(['member-access.php','member-badges.php','community-navigation.php','community-music.php','community-core.php','community.php','community-install.php']as $file)copy('bridge/'.$file,$root.'/noa-bridge/'.$file);
copy('deploy/noa-community.extend.php',$root.'/extend/noa.01-community.php');copy('deploy/noa-design.extend.php',$root.'/extend/noa.design.php');
foreach(['noa-community.js','noa-community.css','noa-ui.js','noa-ui.css','noa-design.json','noa-ui-words.json','noa-account.js','noa-account.css','noa-launch.js','noa-manifest.json','noa-sw.js']as $file)copy('deploy/'.$file,$root.'/'.$file);
copy('deploy/noa-app/home.php',$root.'/noa-app/home.php');file_put_contents($root.'/index.php',"<?php require __DIR__.'/common.php';require __DIR__.'/noa-app/home.php';");
$html= <<<'PHP'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css"><script type="application/json" id="noa-access">{"home":true,"member":true,"music":true,"admin":false}</script><script src="/noa-ui.js" defer></script><script src="/noa-account.js" defer></script></head><body class="noa-page"><main><h1><?=str_contains($_SERVER['REQUEST_URI'],'youtube')?'YouTube':'음원'?></h1><section id="existing-page-content"><p>기존 음악 탐색 영역</p></section></main></body></html>
PHP;
foreach(['noa-youtube.php','noa-music.php']as $file)file_put_contents($root.'/'.$file,$html);
file_put_contents($root.'/bbs/board.php',"<?php require dirname(__DIR__).'/common.php';echo 'NATIVE_PRIVATE_BODY_SENTINEL';");
foreach(['password_check','write_update','write_comment_update','download','rss']as $file)copy($root.'/bbs/board.php',$root.'/bbs/'.$file.'.php');
$router= <<<'PHP'
<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(preg_match('~^/song_request/(\d+)$~',$path,$m)){$_GET['bo_table']='song_request';$_GET['wr_id']=$m[1];$_SERVER['SCRIPT_FILENAME']=__DIR__.'/bbs/board.php';require __DIR__.'/bbs/board.php';return true;}
if($path==='/noa-bridge/ui-preferences.php'||$path==='/noa-bridge/membership.php'){require __DIR__.'/common.php';header('Content-Type: application/json');echo json_encode(['ok'=>true,'member'=>!!$member,'name'=>$member['mb_nick']??'','displayName'=>$member['mb_nick']??'','balance'=>600,'remainingDays'=>0,'admin'=>$is_admin==='super','revision'=>0,'defaults'=>['enabled'=>['noa-studio','noa-ivory'],'theme'=>'noa-studio']]);return true;}
return false;
PHP;
file_put_contents($root.'/router.php',$router);
$db=new mysqli('127.0.0.1','root','fixture-only');$db->query('DROP DATABASE IF EXISTS noa_community');$db->query('CREATE DATABASE noa_community CHARACTER SET utf8mb4');$db->select_db('noa_community');$db->query("SET SESSION sql_mode=''");
$db->query('CREATE TABLE g5_group (gr_id VARCHAR(20) PRIMARY KEY,gr_use_access INT NOT NULL DEFAULT 0)');$db->query("INSERT INTO g5_group VALUES ('community',0)");
$db->query("CREATE TABLE g5_board (bo_table VARCHAR(20) PRIMARY KEY,bo_subject VARCHAR(255) NOT NULL,bo_mobile_subject VARCHAR(255) DEFAULT '',bo_order INT NOT NULL DEFAULT 0,gr_id VARCHAR(20) NOT NULL,bo_list_level INT DEFAULT 1,bo_read_level INT DEFAULT 1,bo_write_level INT DEFAULT 1,bo_reply_level INT DEFAULT 1,bo_comment_level INT DEFAULT 1,bo_use_secret INT DEFAULT 0,bo_use_search INT DEFAULT 0,bo_use_rss_view INT DEFAULT 0,bo_use_cert VARCHAR(10) DEFAULT '',bo_count_write INT DEFAULT 0,bo_count_comment INT DEFAULT 0,bo_10 VARCHAR(255) DEFAULT '')");
$db->query("INSERT INTO g5_board (bo_table,bo_subject,gr_id) VALUES ('free','자유게시판','community')");
$db->query(str_replace('__TABLE_NAME__','g5_write_free',file_get_contents('tests/community/native-write.sql')));
$db->query('CREATE TABLE g5_board_new (bn_id INT AUTO_INCREMENT PRIMARY KEY,bo_table VARCHAR(20),wr_id INT,wr_parent INT,bn_datetime DATETIME,mb_id VARCHAR(20))');
require $root.'/common.php';require $root.'/noa-bridge/community-install.php';
$before=nc_one("SELECT * FROM g5_board WHERE bo_table='free'");$first=nc_install();$second=nc_install();if(!$first['created']||$second['created']||$before!==nc_one("SELECT * FROM g5_board WHERE bo_table='free'"))throw new RuntimeException('installer_not_idempotent');
for($i=1;$i<=8;$i++)nc_query("INSERT INTO g5_write_free (wr_id,wr_subject,wr_content,wr_option,wr_datetime,wr_parent) VALUES ($i,'자유게시판 제목 $i','자유게시판 본문 $i \\n <script>unsafe()</script>',".nc_q($i===7?'secret':'').",'2026-10-26 12:00:00',$i)");
foreach(['gallery'=>'갤러리','qa'=>'질문답변','notice'=>'공지사항','staffonly'=>'관리 전용','certonly'=>'인증 전용','grouponly'=>'그룹 전용']as $board=>$title){
 nc_query('INSERT INTO g5_board (bo_table,bo_subject,gr_id,bo_list_level,bo_use_cert) VALUES ('.nc_q($board).','.nc_q($title).",'community',".($board==='staffonly'?10:1).','.nc_q($board==='certonly'?'adult':'').')');
 nc_query('CREATE TABLE '.nc_write_table($board).' LIKE g5_write_free');
 for($i=1;$i<=7;$i++)nc_query('INSERT INTO '.nc_write_table($board)." (wr_id,wr_subject,wr_content,wr_option,wr_datetime,wr_parent) VALUES ($i,".nc_q($title.' 제목 '.$i).','.nc_q($title.' 본문 '.$i).','.nc_q($i===7?'secret':'').",'2026-10-26 12:00:00',$i)");
}
foreach(['free','gallery','qa']as $board)nc_query('UPDATE '.nc_write_table($board)." SET wr_name='공개 작성자 닉네임'");
nc_query("INSERT INTO g5_group VALUES ('restricted',1)");nc_query("UPDATE g5_board SET gr_id='restricted' WHERE bo_table='grouponly'");
@mkdir('community-proof',0700,true);file_put_contents('community-proof/isolated-install.json',json_encode(['first'=>$first,'replay'=>$second,'existingBoardPreserved'=>true,'environment'=>'isolated MySQL database, not production'],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));echo "COMMUNITY_ISOLATED_NATIVE_FIXTURE_READY\n";

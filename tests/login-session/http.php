<?php
define('_GNUBOARD_',true);
require getenv('N80_SESSION_MODULE');
$root=getenv('N80_SESSION_TEST_ROOT');session_save_path($root.'/legacy');
ini_set('session.gc_probability','0');session_set_cookie_params(0,'/',null,false,true);
n80_session_bootstrap($root.'/private');session_start();
$op=$_GET['op']??'';
if($op==='login'){session_regenerate_id(false);$_SESSION['ss_mb_id']='fixture';}
if($op==='logout'){$_SERVER['REQUEST_URI']='/bbs/logout.php';session_unset();session_destroy();}
if($op==='gc')session_gc();
setcookie('unrelated','preserved',['path'=>'/','httponly'=>true]);
header('Content-Type: application/json');echo json_encode(['member'=>!empty($_SESSION['ss_mb_id']),'ttl'=>(int)ini_get('session.gc_maxlifetime'),'private'=>session_save_path()===$root.'/private']);

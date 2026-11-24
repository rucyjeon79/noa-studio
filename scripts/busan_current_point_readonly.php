<?php
// Production-safe evidence query: READ ONLY, no member rows, tokens or secrets in output.
ini_set('display_errors','0');
error_reporting(0);
function result($data) {
  echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
$p='/hosting/rucyjeon79/html/data/dbconfig.php';
if(!is_file($p)) result(['status'=>'unavailable','reason'=>'dbconfig_not_visible']);
define('_GNUBOARD_',true);
require $p;
if(!defined('G5_MYSQL_HOST') || !defined('G5_MYSQL_DB') ||
   G5_MYSQL_DB !== 'rucyjeon79' || G5_MYSQL_USER !== 'rucyjeon79') {
  result(['status'=>'blocked','reason'=>'wrong_database']);
}
if(!extension_loaded('mysqli')) result(['status'=>'unavailable','reason'=>'mysqli_not_loaded']);
mysqli_report(MYSQLI_REPORT_OFF);
$connection=@mysqli_connect(G5_MYSQL_HOST,G5_MYSQL_USER,G5_MYSQL_PASSWORD,G5_MYSQL_DB);
if(!$connection) result(['status'=>'unavailable','reason'=>'db_not_connected']);
mysqli_set_charset($connection,'utf8mb4');
$configuration=@mysqli_query($connection,"SELECT cf_use_point,cf_register_point,cf_login_point,cf_point_term,cf_read_point,cf_write_point,cf_comment_point,cf_download_point FROM g5_config LIMIT 1");
if(!$configuration) result(['status'=>'unavailable','reason'=>'config_query_failed']);
$settings=mysqli_fetch_assoc($configuration);
if(!is_array($settings)) result(['status'=>'unavailable','reason'=>'config_empty']);
$boards=@mysqli_query($connection,"SELECT bo_table,bo_write_point,bo_comment_point,bo_read_point,bo_download_point FROM g5_board ORDER BY bo_table");
if(!$boards) result(['status'=>'unavailable','reason'=>'board_query_failed']);
$records=[];
while($b=mysqli_fetch_assoc($boards)) {
  if(count($records)>=120) result(['status'=>'blocked','reason'=>'too_many_boards']);
  $records[]=[
    'bo_table'=>(string)$b['bo_table'],
    'bo_write_point'=>(int)$b['bo_write_point'],
    'bo_comment_point'=>(int)$b['bo_comment_point'],
    'bo_read_point'=>(int)$b['bo_read_point'],
    'bo_download_point'=>(int)$b['bo_download_point'],
  ];
}
mysqli_close($connection);
foreach($settings as $key=>$value) $settings[$key]=(int)$value;
result(['status'=>'verified','source'=>'live_readonly_gnuboard_database',
  'config'=>$settings,'boards'=>$records,'board_count'=>count($records)]);

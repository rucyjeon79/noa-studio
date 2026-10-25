<?php
/** Disposable MySQL fixture; never deployed. Native G5 function contract on one connection. */
declare(strict_types=1);define('_GNUBOARD_',true);mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
$g5=['connect_db'=>new mysqli('127.0.0.1','root','isolated-noa-ci','noa_subscription_test',3306),'member_table'=>'g5_member','point_table'=>'g5_point'];$g5['connect_db']->set_charset('utf8mb4');$config=['cf_use_point'=>true];
function sql_query($sql,$error=false){global $g5;return $g5['connect_db']->query($sql);}
function sql_fetch_array($r){return $r->fetch_assoc();}
function get_point_sum($id){$r=sql_query("SELECT COALESCE(SUM(po_point),0) AS n FROM g5_point WHERE mb_id='".mysqli_real_escape_string($GLOBALS['g5']['connect_db'],$id)."'");return (int)sql_fetch_array($r)['n'];}
function insert_point($id,$point,$content='',$table='',$rel='',$action='',$expire=0){$e=fn($v)=>mysqli_real_escape_string($GLOBALS['g5']['connect_db'],(string)$v);$r=sql_query("SELECT COUNT(*) AS n FROM g5_point WHERE mb_id='".$e($id)."' AND po_rel_table='".$e($table)."' AND po_rel_id='".$e($rel)."' AND po_rel_action='".$e($action)."'");if((int)sql_fetch_array($r)['n'])return -1;sql_query("INSERT INTO g5_point(mb_id,po_point,po_rel_table,po_rel_id,po_rel_action) VALUES('".$e($id)."',".(int)$point.",'".$e($table)."','".$e($rel)."','".$e($action)."')");sql_query("UPDATE g5_member SET mb_point=".get_point_sum($id)." WHERE mb_id='".$e($id)."'");return 1;}
require_once __DIR__.'/../../bridge/subscription-core.php';

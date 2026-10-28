<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 $cert=[];foreach(['cf_cert_use','cf_cert_hp','cf_cert_simple','cf_cert_ipin','cf_cert_req','cf_use_email_certify'] as $k)$cert[$k]=$config[$k]??null;
 $credentials=[];foreach(['cf_cert_kcb_cd','cf_cert_kcp_cd','cf_cert_kcp_enckey','cf_cert_kcp_sign','cf_cert_simple_mid','cf_cert_simple_key'] as $k)$credentials[$k]=!empty($config[$k]);
 $tables=[];foreach(['member_table','board_table'] as $key){$name=$g5[$key];if(!preg_match('/^[A-Za-z0-9_]+$/D',$name))throw new RuntimeException('table');$r=sql_query('SHOW COLUMNS FROM `'.$name.'`');$columns=[];while($row=sql_fetch_array($r))$columns[]=$row;$tables[$key]=['columns'=>$columns,'engine'=>sql_fetch("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".sql_escape_string($name)."'")['ENGINE']];}
 $result=['ok'=>true,'version'=>defined('G5_GNUBOARD_VER')?G5_GNUBOARD_VER:'unknown','cert'=>$cert,'credentialPresence'=>$credentials,'tables'=>$tables,'databaseWrites'=>0];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>'inventory_failed'];}
while(ob_get_level()>$buffer)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);

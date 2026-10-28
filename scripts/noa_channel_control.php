<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_NOTIFICATION_EXPIRY||!hash_equals('NOA_NOTIFICATION_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-core.php';
try{
 $db=noa_bridge_pdo();$owner=(string)($config['cf_admin']??'');
 if(!preg_match('/^[A-Za-z0-9_]+$/D',$g5['member_table']))throw new RuntimeException('member_table');
 $q=$db->prepare('SELECT mb_id FROM `'.$g5['member_table'].'` WHERE mb_id=? AND mb_leave_date=\'\' AND mb_intercept_date=\'\'');$q->execute([$owner]);if(!$q->fetchColumn())throw new RuntimeException('administrator_missing');
 $b=json_decode(file_get_contents('php://input'),true,8,JSON_THROW_ON_ERROR);
 $result=nco_bind($db,$owner,dirname(dirname(__DIR__)).'/noa-channel-backups',($b['apply']??false)===true);
 $result['listed']=count(nc_owned_records($db,$owner));
 $result['nativeTablesWritten']=0;
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);

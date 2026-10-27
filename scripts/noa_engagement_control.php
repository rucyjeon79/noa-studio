<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_ENGAGEMENT_EXPIRY||!hash_equals('NOA_ENGAGEMENT_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/engagement-core.php';
try{$db=noa_bridge_pdo();$before=$db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);$created=ne_install($db);$after=$db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);if(array_diff($before,$after))throw new RuntimeException('existing_table_missing');$counts=[];foreach(array_keys(ne_schema())as $t)$counts[$t]=(int)$db->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();$result=['ok'=>true,'created'=>$created,'ready'=>ne_ready($db),'counts'=>$counts,'existingTablesRetained'=>true,'nativeTablesWritten'=>0,'syntheticReactionsCreated'=>0];}
catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>get_class($e)];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);

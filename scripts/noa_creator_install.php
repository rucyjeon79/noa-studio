<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CREATOR_EXPIRY||!hash_equals('NOA_CREATOR_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-enrollment-core.php';
try{
 $db=noa_bridge_pdo();$root=dirname(G5_PATH).'/noa-creator-enrollment';
 if(is_link($root)||(!is_dir($root)&&!mkdir($root,0700)))throw new RuntimeException('storage_unavailable');chmod($root,0700);
 if(is_link($root.'/symbols')||(!is_dir($root.'/symbols')&&!mkdir($root.'/symbols',0700)))throw new RuntimeException('symbol_storage_unavailable');chmod($root.'/symbols',0700);
 if(!file_exists($root.'/master.key')){$f=fopen($root.'/master.key','x');if(!$f)throw new RuntimeException('key_create_failed');chmod($root.'/master.key',0600);fwrite($f,random_bytes(32));fclose($f);}nce_key();
 foreach(['noa_creator_applications','noa_creator_limits'] as $name){$r=nce_one($db,'SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[$name]);if($r&&$r['TABLE_COMMENT']!==NCE_MARKER)throw new RuntimeException('existing_table_preserved');}
 nce_schema($db);$owner=(string)$config['cf_admin'];$channel=nc_row($db,nc_channel_key($owner));if(!$channel||($channel['document']['ownerId']??'')!==$owner)throw new RuntimeException('existing_owner_channel_required');
 $id=nce_board($db,$owner,(string)$channel['document']['title']);$d=$channel['document'];$changed=($d['boardId']??'')!==$id;if($changed){$d['boardId']=$id;nc_store($db,nc_channel_key($owner),'prefs',$d,$channel['revision'],$owner);}
 $result=['ok'=>true,'schemaReady'=>true,'certConfigured'=>count(nce_cert_options($config))>0,'administratorChannelBoard'=>$id,'channelUpdated'=>$changed,'memberRowsChanged'=>0,'contentRowsChanged'=>0,'privateStorage'=>true,'applicationCount'=>(int)$db->query('SELECT COUNT(*) FROM noa_creator_applications')->fetchColumn()];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>$e->getMessage()];}
while(ob_get_level()>$buffer)ob_end_clean();echo json_encode($result,JSON_THROW_ON_ERROR);

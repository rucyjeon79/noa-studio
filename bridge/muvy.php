<?php
declare(strict_types=1);ini_set('display_errors','0');
$mu_output_level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$mu_output_level)ob_end_clean();require_once __DIR__.'/lab-core.php';lab_admin();require_once __DIR__.'/muvy-core.php';
$_SESSION['noa_lab_csrf']??=bin2hex(random_bytes(32));
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='GET')lab_json(200,['ok'=>true,'csrf'=>$_SESSION['noa_lab_csrf']]+mu_status((string)($_GET['id']??'')));
 if($method!=='POST')lab_json(405,['error'=>'method_not_allowed']);lab_csrf();$b=lab_json_body(2097152);$action=$b['action']??'';
 if($action==='config')$result=mu_settings($b);elseif($action==='save')$result=mu_save($b);elseif($action==='recover')$result=mu_recover($b);
 elseif($action==='selectSong'){
  require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/inline-edit.php';
  $record=nie_resolve(noa_bridge_pdo(),['type'=>'song','source'=>'music','key'=>$b['key']??'']);
  $result=mu_select_song($record);
 }
 elseif($action==='generate'){$b['runtimeContract']=2;$result=mu_begin($b);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();require_once dirname(__DIR__).'/noa-app/engine/worker-wake.php';$result['wake']=n80_ai_wake();}
 else throw new InvalidArgumentException('unknown_action');if(isset($result['project']))$result['project']=mu_public_project($result['project']);lab_json(200,['ok'=>true]+$result);
}catch(DomainException $e){lab_json(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException $e){lab_json(400,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-muvy] '.get_class($e));lab_json(503,['ok'=>false,'error'=>'muvy_unavailable']);}

<?php
declare(strict_types=1);ini_set('display_errors','0');
$mu_output_level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$mu_output_level)ob_end_clean();require_once __DIR__.'/lab-core.php';lab_admin();require_once __DIR__.'/muvy-core.php';
$_SESSION['noa_lab_csrf']??=bin2hex(random_bytes(32));
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';if($method==='GET')lab_json(200,['ok'=>true,'csrf'=>$_SESSION['noa_lab_csrf']]+mu_status((string)($_GET['id']??'')));
 if($method!=='POST')lab_json(405,['error'=>'method_not_allowed']);lab_csrf();$b=lab_json_body(2097152);$action=$b['action']??'';
 if($action==='config')$result=mu_settings($b);elseif($action==='save')$result=mu_save($b);elseif($action==='recover')$result=mu_recover($b);
 elseif($action==='generate'){$task=mu_begin($b);if($task['replayed'])lab_json(200,['ok'=>true]+$task);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();ignore_user_abort(true);@set_time_limit(120);try{$generated=mu_provider($task);$result=mu_finish($task,$generated);}catch(Throwable $e){$safe=in_array($e->getMessage(),['provider_access_denied','provider_rate_limit','provider_incomplete','provider_unconfirmed','provider_format','provider_failed','xai_key_required'],true)?$e->getMessage():'provider_format';mu_finish($task,null,$safe);throw new DomainException($safe);}}
 else throw new InvalidArgumentException('unknown_action');lab_json(200,['ok'=>true]+$result);
}catch(DomainException $e){lab_json(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException $e){lab_json(400,['ok'=>false,'error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-muvy] '.get_class($e));lab_json(503,['ok'=>false,'error'=>'muvy_unavailable']);}

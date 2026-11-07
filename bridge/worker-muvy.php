<?php
declare(strict_types=1);
if(!isset($context,$b,$action))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/muvy-core.php';
if($action==='muvy_claim')return mu_worker_claim();
$error=$b['error']??null;
if($action==='muvy_complete'&&(!is_array($b['result']??null)||$error!==null))throw new InvalidArgumentException('invalid_result');
if($action==='muvy_failed'&&!in_array($error,['provider_access_denied','provider_rate_limit','provider_incomplete','provider_unconfirmed','provider_format','provider_failed'],true))throw new InvalidArgumentException('invalid_error');
return ['ok'=>true]+mu_finish($b,$action==='muvy_complete'?($b['result']??null):null,$error);

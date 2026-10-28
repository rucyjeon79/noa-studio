<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CONTROL_EXPIRY||!hash_equals('NOA_CONTROL_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$base=ob_get_level();ob_start();
try{
 require dirname(__DIR__).'/common.php';require_once __DIR__.'/membership-core.php';
 $body=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);if(($body['approvedPolicy']??'')!=='NOA-20261028-MONTHLY-10X')throw new DomainException('policy_identity_required');
 if(!ns_storage(true)['ready'])throw new DomainException('points_storage_not_ready');
 foreach(['noa_post_likes','noa_post_like_events']as $table){$e=ns_one('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.ns_e($table));if(strtoupper($e['ENGINE']??'')!=='INNODB')throw new DomainException('likes_storage_not_ready');}
 $subscription=ns_policy();
 $result=ns_atomic('membership-policy',false,function(){
  $before=ns_doc(NR_POLICY,true);if(empty($before['data']['enabled']))throw new DomainException('membership_policy_required');$next=$before['data'];
  $existing=$next['monthlyBenefits']??null;$desired=['enabled'=>true,'multiplier'=>10,'likePoints'=>10,'activatedAt'=>$existing['activatedAt']??time(),'timezone'=>'Asia/Seoul'];
  if($existing!==null&&$existing!==$desired)throw new DomainException('monthly_policy_conflict');
  $changed=$existing===null;$next['monthlyBenefits']=$desired;
  if($changed)ns_put(NR_POLICY,'prefs',$next,$before['revision'],'monthly-policy');
  $after=ns_doc(NR_POLICY);if($after['data']!==$next||!nmb_rules())throw new RuntimeException('monthly_policy_verification_failed');
  return ['ok'=>true,'policyChanged'=>$changed,'policyRevision'=>$after['revision'],'monthlyBenefits'=>$desired,'firstMonthlyPoints'=>['login'=>1000,'write'=>500,'comment'=>300,'like'=>100],'basePoints'=>['login'=>100,'write'=>50,'comment'=>30,'like'=>10],'memberRowsChanged'=>0,'pointsGranted'=>0];
 });
 if(ns_policy()!==$subscription)throw new RuntimeException('subscription_policy_changed');$result['subscriptionPolicyPreserved']=true;
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>$e instanceof DomainException?$e->getMessage():'monthly_policy_failed'];}
while(ob_get_level()>$base)ob_end_clean();echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);

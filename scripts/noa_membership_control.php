<?php
declare(strict_types=1);
/** Temporary, expiring control. All member data and backup rows remain in the same hosting database. */
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_CONTROL_EXPIRY||!hash_equals('NOA_CONTROL_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/subscription-core.php';
/*NOA_STORAGE_FUNCTIONS*/
try{
 $body=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$mode=$body['mode']??'';if(!in_array($mode,['audit','activate'],true))throw new RuntimeException('invalid_mode');
 $tables=[];foreach(['member_table','point_table','config_table']as $key){$name=trim(ns_table($key),'`');$tables[$key]=['name'=>$name,'engine'=>nrm_engine($name),'rows'=>(int)ns_one('SELECT COUNT(*) AS n FROM `'.$name.'`')['n']];}
 $root=dirname(__DIR__);$hooks=[];foreach(['bbs/write_update.php'=>'write_update_after','bbs/write_comment_update.php'=>'comment_update_after','adm/config_form_update.php'=>'cf_login_point']as $path=>$hook){$source=(string)file_get_contents($root.'/'.$path);$hooks[$path]=['sha256'=>hash('sha256',$source),'expectedHookPresent'=>str_contains($source,$hook)];}
 $result=['ok'=>true,'mode'=>$mode,'checkedAt'=>gmdate('c'),'tables'=>$tables,'nativePointsEnabled'=>!empty($config['cf_use_point']),'nativeLoginPoints'=>(int)$config['cf_login_point'],'hooks'=>$hooks,'databaseWrites'=>0,'sensitiveDataExported'=>false];
 $result['social']=['enabled'=>!empty($config['cf_social_login_use']),'services'=>(string)($config['cf_social_servicelist']??''),'googleClientPresent'=>!empty($config['cf_google_clientid']),'googleSecretPresent'=>!empty($config['cf_google_secret']),'kakaoClientPresent'=>!empty($config['cf_kakao_rest_key']),'kakaoSecretPresent'=>!empty($config['cf_kakao_client_secret']),'nativeSessionVerifier'=>function_exists('social_session_exists_check')];
 $result['nativeContracts']=[];foreach(['extend/social_login.extend.php','bbs/register_form.php','bbs/register_form_update.php','bbs/write_update.php','bbs/write_comment_update.php']as $file){$code=(string)file_get_contents($root.'/'.$file);$lines=[];foreach(explode("\n",$code)as $line)if(preg_match('/run_event\(|social_session_exists_check|social_login\.php|includes\/functions|bo_write_point|bo_comment_point/',$line))$lines[]=trim($line);$result['nativeContracts'][$file]=['sha256'=>hash('sha256',$code),'calls'=>$lines];}
 if($mode==='activate'){
  require_once __DIR__.'/membership-core.php';
  foreach($hooks as $h)if(!$h['expectedHookPresent'])throw new RuntimeException('native_hook_contract_mismatch');
  if(empty($body['approvedPolicy'])||$body['approvedPolicy']!=='NOA-20261026-MEMBERSHIP-REWARDS')throw new RuntimeException('policy_identity_required');
  $installed=ns_doc(NR_POLICY);if($installed&&!empty($installed['data']['enabled'])){nr_reply_control($result+['alreadyActive'=>true,'revision'=>$installed['revision']]);}
  $lock=ns_one("SELECT GET_LOCK('noa-membership-install',0) AS acquired");if((int)$lock['acquired']!==1)throw new RuntimeException('membership_install_busy');
  try{
   $backups=nrm_backup_convert($tables);
   ns_q('UPDATE '.ns_table('config_table').' SET cf_login_point=0,cf_use_point=1');$config['cf_login_point']=0;$config['cf_use_point']=1;
   $policy=ns_policy();$next=$policy['values'];$next['enabled']=true;$next['pointsEnabled']=true;$next['plans']['vip']=['enabled'=>true,'priceWon'=>3000,'points'=>3000,'durationDays'=>30];
   $rules=['version'=>1,'enabled'=>true,'regularThreshold'=>1000,'loginPending'=>100,'writePoints'=>50,'commentPoints'=>30,'loginFrequency'=>'KST_calendar_day','youtubeRewardEnabled'=>false,'youtubeRewardStatus'=>'provider_policy_review','wonPerPoint'=>1,'approvedInstruction'=>'NOA-20261026-MEMBERSHIP-REWARDS','activatedAt'=>time(),'backupProof'=>$backups];
   ns_atomic('membership-policy',false,function()use($policy,$next,$rules,$installed){ns_put(NS_POLICY,'prefs',ns_policy_validate($next),$policy['revision'],'membership-policy');ns_put(NR_POLICY,'prefs',$rules,$installed['revision']??0,'membership-policy');});
   $count=0;$rows=ns_q('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_level BETWEEN 2 AND 4');$owners=[];while($row=sql_fetch_array($rows))$owners[]=$row['mb_id'];foreach($owners as $owner){nr_refresh($owner,time());$count++;}
   $result+=['activated'=>true,'backups'=>$backups,'sameDatabaseBackup'=>true,'isolatedRestoreVerified'=>true,'normalMembersReconciled'=>$count,'policy'=>array_diff_key($rules,['backupProof'=>true]),'subscriptionPolicyRevision'=>ns_policy()['revision']];$result['databaseWrites']='approved_policy_and_transactional_engine_migration';
  }finally{ns_q("SELECT RELEASE_LOCK('noa-membership-install')");}
 }
 nr_reply_control($result);
}catch(Throwable $e){http_response_code(409);echo json_encode(['ok'=>false,'error'=>($e instanceof mysqli_sql_exception?'database_operation_failed':$e->getMessage()),'type'=>get_class($e)],JSON_THROW_ON_ERROR);}
function nr_reply_control(array $result):never{echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}

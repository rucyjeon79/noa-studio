<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/referral-core.php';
if(($argv[1]??'')==='check'){
 if(get_point_sum('native_new')!==500||get_point_sum('inviter')!==2000)throw new RuntimeException('native_shutdown_award_failed');
 echo "NATIVE_SOCIAL_VERIFIED_SESSION_COMPLETION_OK\n";exit;
}
ns_q("INSERT INTO g5_member(mb_id,mb_level,mb_point,mb_datetime) VALUES('native_new',2,0,'2026-10-31 12:00:00')");
define('G5_TIME_YMDHIS','2026-10-31 12:00:00');function social_session_exists_check(){return (object)['identifier'=>'qa-native-provider-proof'];}
$_SERVER['REQUEST_URI']='/plugin/social/register_member_update.php';$_SERVER['REQUEST_METHOD']='POST';$_REQUEST['provider']='Google';
$_SESSION=['noa_referral'=>['code'=>trim(file_get_contents(sys_get_temp_dir().'/nrf-ci-code')),'capturedAt'=>time()]];$member=[];
$root=sys_get_temp_dir().'/nrf-native-fixture';@mkdir($root);@mkdir($root.'/extend');if(!is_link($root.'/noa-bridge'))symlink(realpath(__DIR__.'/../../bridge'),$root.'/noa-bridge');copy(__DIR__.'/../../deploy/noa-referral.extend.php',$root.'/extend/referral.php');require $root.'/extend/referral.php';
// The installed native adapter sets this only inside its successful INSERT branch.
$_SESSION['ss_mb_reg']='native_new';

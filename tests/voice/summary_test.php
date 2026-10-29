<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/noa-summary-'.bin2hex(random_bytes(6));mkdir($root,0700);mkdir($root.'/bridge',0700);
try{
 copy(__DIR__.'/../../bridge/membership.php',$root.'/bridge/membership.php');
 file_put_contents($root.'/common.php', <<<'CODE'
<?php
session_start();$member=['mb_id'=>'fixture','mb_level'=>4];$is_admin='';$_SERVER['REQUEST_METHOD']='GET';$_GET['action']='summary';
register_shutdown_function(function(){if(session_status()===PHP_SESSION_ACTIVE)throw new RuntimeException('read_session_not_released');});
CODE);
 file_put_contents($root.'/bridge/member-access.php', '<?php function nam_access($m,$a){return ["member"=>true,"admin"=>false,"name"=>"VIP","level"=>4];}');
 file_put_contents($root.'/bridge/membership-core.php', <<<'CODE'
<?php
function nr_member($owner,$lock){if($owner!=='fixture'||$lock)throw new RuntimeException('wrong_owner_or_lock');return ['mb_point'=>1234];}
function ns_member_key($owner){return 'grant:'.$owner;}
function ns_doc($key){if($key!=='grant:fixture')throw new RuntimeException('unneeded_query');return ['data'=>['baseLevel'=>3,'paidLevel'=>4,'status'=>'active','until'=>time()+86400,'private'=>'never expose']];}
function nr_policy(){throw new RuntimeException('full_policy_not_needed_for_summary');}
function ns_q($query){throw new RuntimeException('ledger_or_orders_not_needed_for_summary');}
CODE);
 exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg($root.'/bridge/membership.php'),$output,$status);if($status!==0)throw new RuntimeException('summary_failed');$d=json_decode(implode("\n",$output),true,512,JSON_THROW_ON_ERROR);
 if(!$d['ok']||$d['balance']!==1234||$d['remainingDays']!==1||strlen($d['csrf'])!==64||isset($d['grant']['private'])||isset($d['ledger'])||isset($d['topups']))throw new RuntimeException('summary_contract');
 echo "MEMBERSHIP_SUMMARY_OWNER_SESSION_PRIVACY_AND_QUERY_BUDGET_OK\n";
}finally{foreach(glob($root.'/bridge/*')as $f)unlink($f);unlink($root.'/common.php');rmdir($root.'/bridge');rmdir($root);}

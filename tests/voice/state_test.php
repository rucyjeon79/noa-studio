<?php
define('_GNUBOARD_',true);
$grant=null;$fail=false;
function noa_bridge_pdo(){return null;}
function ns_read_grant($db,$owner){if($GLOBALS['fail'])throw new RuntimeException('fixture');return $GLOBALS['grant'];}
require __DIR__.'/../../deploy/noa-voice-state.php';
function check($ok,$name){if(!$ok)throw new RuntimeException($name);}
$a=['music'=>false,'admin'=>false];$m=['mb_id'=>'private-owner','mb_nick'=>'노아팬','mb_point'=>1234];
$d=noa_voice_state([],$a);check(!$d['member']&&$d['balance']===null&&$d['remainingDays']===null,'guest does not invent zero balance');
$d=noa_voice_state($m,$a);check($d['displayName']==='노아팬'&&$d['balance']===1234&&$d['remainingDays']===0&&$d['subscription']==='구독 없음','member facts');check(!str_contains(json_encode($d),'private-owner'),'no raw owner id');
$grant=['status'=>'active','until'=>time()+86400*12];$d=noa_voice_state($m,$a);check($d['remainingDays']===12&&$d['subscription']==='구독 중','active days');
$grant=['status'=>'active','until'=>time()-10];$d=noa_voice_state($m,$a);check($d['remainingDays']===0&&$d['subscription']==='구독 만료','expired not active');
$grant=null;$d=noa_voice_state($m,['music'=>true,'admin'=>false]);check($d['remainingDays']===null&&str_contains($d['subscription'],'종료일 미등록'),'legacy VIP no invented expiry');
$fail=true;$d=noa_voice_state($m,$a);check($d['remainingDays']===null&&$d['subscription']==='확인 중'&&$d['balance']===1234,'lookup failure not no subscription');
echo "WELCOME_VERIFIED_FACTS_OK\n";

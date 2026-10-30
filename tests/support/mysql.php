<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/support-core.php';
function sc($ok,$msg){if(!$ok)throw new RuntimeException($msg);}function sid($n){return sprintf('ab000000-0000-4000-8000-%012d',$n);}function denied($f,$code){try{$f();}catch(DomainException|InvalidArgumentException $e){sc($e->getMessage()===$code,$e->getMessage().' != '.$code);return;}throw new RuntimeException('missing_denial_'.$code);}
ns_q("ALTER TABLE g5_member ADD mb_leave_date VARCHAR(8) NOT NULL DEFAULT '', ADD mb_intercept_date VARCHAR(8) NOT NULL DEFAULT ''");
foreach(['s_sender'=>[2,10000],'s_receiver'=>[5,0],'s_other'=>[5,0],'s_race'=>[3,10000],'s_empty'=>[3,10]] as $name=>$v){ns_q('INSERT INTO g5_member(mb_id,mb_level,mb_point) VALUES('.ns_e($name).','.$v[0].',0)');if($v[1])insert_point($name,$v[1],'fixture','fixture',$name,'seed');}
$config['cf_admin']='s_admin';
$t=['owner'=>'s_receiver','channelId'=>hash('sha256','s_receiver'),'channelTitle'=>'검수 채널','entity'=>'song:test','title'=>'검수 곡'];
$b=['type'=>'music','key'=>'test','entity'=>$t['entity'],'channelId'=>$t['channelId'],'amount'=>1234,'message'=>'응원합니다','confirmed'=>true];
$r=nsp_send('s_sender',sid(1),$b,fn()=>$t);sc($r['amount']===1234&&get_point_sum('s_sender')===8766&&nsp_wallet('s_receiver')['data']['received']===1234,'atomic_debit_and_credit');
sc(nsp_send('s_sender',sid(1),$b,fn()=>throw new RuntimeException('replay_must_not_resolve'))['replayed']&&get_point_sum('s_sender')===8766,'idempotent_retry');sc(nsp_count($t['entity'])===1,'one_count');
denied(fn()=>nsp_send('s_sender',sid(1),array_replace($b,['amount'=>2]),fn()=>$t),'request_conflict');
foreach([0,-1,1.5,'12']as $amount)denied(fn()=>nsp_send('s_sender',sid(2),array_replace($b,['amount'=>$amount]),fn()=>$t),'positive_integer_required');
denied(fn()=>nsp_send('s_sender',sid(2),array_replace($b,['amount'=>8767]),fn()=>$t),'insufficient_points');
denied(fn()=>nsp_send('s_sender',sid(2),$b,fn()=>array_replace($t,['owner'=>'s_sender'])),'self_support_denied');
denied(fn()=>nsp_send('s_sender',sid(2),$b,fn()=>array_replace($t,['channelId'=>hash('sha256','s_other')])),'recipient_changed');
denied(fn()=>nsp_send('s_sender',sid(2),array_replace($b,['confirmed'=>false]),fn()=>$t),'confirmation_required');
$full=nsp_send('s_sender',sid(3),array_replace($b,['amount'=>8766]),fn()=>$t);sc(get_point_sum('s_sender')===0&&nsp_wallet('s_receiver')['data']['received']===10000,'full_balance_allowed');
$settlement=nsp_settlement('s_receiver',sid(4),'personal');sc($settlement['gross']===10000&&nsp_wallet('s_receiver')['data']['reserved']===10000,'reserve_all');sc(nsp_settlement('s_receiver',sid(4),'personal')===$settlement,'settlement_idempotent');denied(fn()=>nsp_settlement('s_receiver',sid(5),'business'),'no_settlement_balance');
$key='support:settlement:'.hash('sha256','s_receiver|'.sid(4));denied(fn()=>nsp_review('s_other',$key,'paid',9670,'receipt'),'administrator_required');
$review=nsp_review('s_admin',$key,'rejected',0,'증빙 보완');sc(nsp_wallet('s_receiver')['data']['reserved']===0,'rejection_restores');sc(nsp_review('s_admin',$key,'rejected',0,'증빙 보완')===$review,'review_replay');
$second=nsp_settlement('s_receiver',sid(6),'business');$key2='support:settlement:'.hash('sha256','s_receiver|'.sid(6));nsp_review('s_admin',$key2,'paid',10000,'external-proof-001');sc(nsp_wallet('s_receiver')['data']['paid']===10000&&nsp_wallet('s_receiver')['data']['reserved']===0,'external_payment_record');
// Force a storage conflict after native debit: all writes must roll back.
$bad=array_replace($t,['entity'=>'broken']);ns_atomic('qa',false,fn()=>ns_put('support:count:'.hash('sha256','broken'),'meta',[],0,'qa'));$b2=array_replace($b,['amount'=>5,'entity'=>'broken']);denied(fn()=>nsp_send('s_empty',sid(7),$b2,fn()=>$bad),'revision_conflict');sc(get_point_sum('s_empty')===10&&nsp_wallet('s_receiver')['data']['received']===10000,'receipt_failure_rolls_back');
// Server resolves a channel owner, never a client-provided recipient.
ns_atomic('s_receiver',false,fn()=>ns_put('creator-channel:'.$t['channelId'],'prefs',['ownerId'=>'s_receiver','title'=>'검수 채널'],0,'s_receiver'));
$pdo=new PDO(getenv('NOA_MYSQL_DSN'),'root','isolated-noa-ci');sc(nsp_target($pdo,'channel',$t['channelId'])['owner']==='s_receiver','server_owned_recipient');ns_q("UPDATE g5_member SET mb_intercept_date='20261030' WHERE mb_id='s_receiver'");denied(fn()=>nsp_target($pdo,'channel',$t['channelId']),'member_unavailable');ns_q("UPDATE g5_member SET mb_intercept_date='' WHERE mb_id='s_receiver'");
sc(count(nsp_dashboard('s_receiver')['items'])===2&&count(nsp_dashboard('s_receiver')['requests'])===2,'private_dashboard_history');
echo "SUPPORT_NATIVE_POINTS_IDEMPOTENCE_LIMITS_OWNER_ROLLBACK_SETTLEMENT_OK\n";

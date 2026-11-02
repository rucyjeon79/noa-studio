<?php
declare(strict_types=1);
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_subscription_test;'))throw new RuntimeException('isolated_database_required');
require __DIR__.'/../subscription/native_fixture.php';
define('NOA_TOSS_TEST_HARNESS',true);
require __DIR__.'/../../bridge/toss-core.php';
require __DIR__.'/../../bridge/gift-core.php';
require __DIR__.'/../../bridge/notifications-sources.php';
function gc_check($ok,string $name):void{if(!$ok)throw new RuntimeException($name);}
function gc_deny(callable $fn,string $code):void{
 try{$fn();}catch(DomainException $e){gc_check($e->getMessage()===$code,'unexpected '.$e->getMessage());return;}
 throw new RuntimeException('should reject '.$code);
}
function gc_id(int $i):string{return sprintf('af000000-0000-4000-8000-%012d',$i);}
ns_q("ALTER TABLE g5_member ADD mb_nick VARCHAR(50) DEFAULT '', ADD mb_leave_date VARCHAR(10) DEFAULT '', ADD mb_intercept_date VARCHAR(10) DEFAULT ''");
foreach(['g_sender','g_to','g_other'] as $name)ns_q('INSERT INTO g5_member(mb_id,mb_nick,mb_level,mb_point) VALUES('.ns_e($name).','.ns_e($name).',3,0)');
insert_point('g_sender',10000,'test','test','001','seed');
$policy=ns_doc(NR_POLICY);ns_atomic('policy',false,fn()=>ns_put(NR_POLICY,'prefs',['enabled'=>true,'version'=>1],$policy['revision']??0,'qa'));
$now=time();
$id=gc_id(1);$v=ng_buy_vip('g_sender',$id,'vip30','g_to',$now);
gc_check(!ns_doc(ns_member_key('g_to'))&&get_point_sum('g_sender')===7150,'no automatic VIP');
gc_check(ng_buy_vip('g_sender',$id,'vip30','g_to',$now)===$v&&get_point_sum('g_sender')===7150,'no duplicate debit');
gc_deny(fn()=>ng_update('g_other',$id,'use',0,$now),'gift_not_found');
gc_deny(fn()=>ng_update('g_to',$id,'extend',$v['expiresAt'],$v['expiresAt']),'gift_unavailable');
gc_check(ng_status(ns_doc(ng_key($id))['data'],$v['expiresAt'])==='expired','permanent expired history');
gc_check(count(ng_list('g_to','received',1,$now))===1&&ng_list('g_to','received',1,$v['expiresAt'])===[],'recipient expiry removal');
gc_check(count(ng_list('g_sender','sent',1,$v['expiresAt']))===1&&ng_list('g_other','sent',1,$now)===[],'sender history and ownership');
gc_check(ng_shift(strtotime('2028-02-29 12:00:00 Asia/Seoul'),12)===strtotime('2029-02-28 12:00:00 Asia/Seoul'),'calendar leap day');
$db=new PDO(getenv('NOA_MYSQL_DSN'),getenv('NOA_MYSQL_USER'),getenv('NOA_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach(nnt_schema() as $table=>$ddl)$db->exec("CREATE TABLE IF NOT EXISTS `$table` $ddl ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");
gc_check(ng_available_count('g_to',$now)===1&&ng_available_count('g_sender',$now)===0,'badge belongs only to recipient');
gc_check(nnt_gift_reminders($db,$now,true,'g_sender')===0&&nnt_gift_reminders($db,$now,true,'g_to')===1&&nnt_gift_reminders($db,$now,true)===0,'arrival only once across inbox and worker');
gc_check(nnt_one($db,"SELECT kind FROM noa_notifications WHERE recipient='g_to'")['kind']==='gift_received','arrival notification');
gc_check(nnt_gift_reminders($db,$v['remindAt']-1)===0,'not early');
gc_check(nnt_gift_reminders($db,$v['remindAt'])===1&&nnt_gift_reminders($db,$v['remindAt'])===0,'one reminder per expiry');
$ext=ng_update('g_to',$id,'extend',$v['expiresAt'],$v['remindAt']);
gc_deny(fn()=>ng_update('g_to',$id,'extend',$v['expiresAt'],$now),'gift_changed');
gc_check($ext['expiresAt']===ng_shift($v['expiresAt'],12)&&nnt_gift_reminders($db,$ext['remindAt'])===1,'renewal schedules next reminder');
$used=ng_update('g_to',$id,'use',0,$now);ng_update('g_to',$id,'use',0,$now);
gc_check(ng_available_count('g_to',$now)===0,'used gift clears badge');
gc_check($used['usedAt']===$now&&ns_doc(ns_member_key('g_to'))['data']['until']===$now+30*86400,'one VIP activation');
$GLOBALS['nt_test_config']=['enabled'=>true,'mode'=>'live','clientKey'=>'live_ck_fixture','secretKey'=>'live_sk_fixture','mid'=>'fixture','webhookSecret'=>str_repeat('f',64),'contractApproved'=>true];
$id=gc_id(2);$o=nt_create('g_sender',$id,'p10000',$now,'g_to');
gc_check(!ns_doc(ng_key($id)),'unpaid order cannot issue');
gc_deny(fn()=>nt_create('g_sender',$id,'p10000',$now,'g_other'),'purchase_conflict');
$pay=['paymentKey'=>'fixture_gift','orderId'=>$o['orderId'],'mId'=>$o['mid'],'currency'=>'KRW','totalAmount'=>10000,'balanceAmount'=>10000,'method'=>'카드','status'=>'DONE'];
nt_apply($id,$pay,$now);nt_apply($id,$pay,$now);
gc_check(ns_doc(ng_key($id))['data']['points']===11000&&get_point_sum('g_to')===0&&get_point_sum('g_sender')===7150,'confirmed voucher only');
$pay['status']='PARTIAL_CANCELED';$pay['balanceAmount']=5000;nt_apply($id,$pay,$now);
ng_update('g_to',$id,'use',0,$now);ng_update('g_to',$id,'use',0,$now);
gc_check(get_point_sum('g_to')===5500,'partial refund and one redemption');
$pay['status']='CANCELED';$pay['balanceAmount']=0;nt_apply($id,$pay,$now);nt_apply($id,$pay,$now);
gc_check(get_point_sum('g_to')===0&&get_point_sum('g_sender')===7150,'refund reverses recipient only');
gc_check(ng_status(ns_doc(ng_key($id))['data'],$now)==='canceled','canceled history retained');
echo "STORE_GIFT_AUTH_PAYMENT_REFUND_EXPIRY_RENEWAL_REMINDER_REPLAY_OK\n";

ns_q("INSERT INTO g5_member(mb_id,mb_nick,mb_level,mb_point) VALUES('g_wallet_to','wallet',3,0)");
$walletId=gc_id(10);
$wallet=ng_buy_wallet('g_sender',$walletId,'p1000','g_wallet_to',$now);
gc_check($wallet['points']===1000&&$wallet['debitedPoints']===1000&&get_point_sum('g_sender')===6150,'wallet points fund a gift without PG');
ng_buy_wallet('g_sender',$walletId,'p1000','g_wallet_to',$now);
gc_check(get_point_sum('g_sender')===6150,'wallet replay never debits twice');
$r=ng_update('g_wallet_to',$walletId,'use',0,$now);
gc_check(get_point_sum('g_wallet_to')===1000,'wallet face value reaches recipient');
$id=gc_id(11);
gc_deny(fn()=>ng_buy_wallet('g_sender',$id,'p10000','g_wallet_to',$now),'insufficient_points');
gc_check(!ns_doc(ng_key($id)),'insufficient balance never issues');
$intent=['product'=>'p10000','recipient'=>'g_wallet_to'];
$o=nt_create('g_sender',$id,'p10000',$now,null,$intent);
gc_check($o['priceWon']===3850&&$o['totalPoints']===3850&&$o['bonusPoints']===0,'only shortage charged');
gc_check(nt_create('g_sender',$id,'p10000',$now,null,$intent)===$o,'stable shortfall retry');
gc_deny(fn()=>nt_create('g_sender',$id,'p10000',$now,null,['product'=>'p10000','recipient'=>'g_to']),'purchase_conflict');
$pay=['paymentKey'=>'fixture_gap','orderId'=>$o['orderId'],'mId'=>$o['mid'],'currency'=>'KRW','totalAmount'=>3850,'balanceAmount'=>3850,'method'=>'카드','status'=>'DONE'];
nt_apply($id,$pay,$now);nt_apply($id,$pay,$now);
gc_check(get_point_sum('g_sender')===10000&&!ns_doc(ng_key($id)),'approval credits shortage once');
ng_buy_wallet('g_sender',$id,'p10000','g_wallet_to',$now);
gc_check(get_point_sum('g_sender')===0&&ns_doc(ng_key($id))['data']['points']===10000,'no bonus minted by wallet gifts');
ns_q("INSERT INTO g5_member(mb_id,mb_nick,mb_level,mb_point) VALUES('g_super','super',10,0),('g_staff','staff',10,0)");
$config['cf_admin']='g_super';
foreach(['p50000','vip30'] as $i=>$product){
 $g=ng_buy_wallet('g_super',gc_id(20+$i),$product,'g_wallet_to',$now);
 gc_check($g['funding']==='admin_unlimited'&&$g['debitedPoints']===0&&get_point_sum('g_super')===0,'admin unrestricted budget with audit');
}
gc_deny(fn()=>ng_buy_wallet('g_staff',gc_id(25),'p1000','g_wallet_to',$now),'insufficient_points');
// Restore the balance and received-box fixture used by the subsequent HTTP test.
insert_point('g_sender',7150,'http fixture','wallet-test','http','seed');
echo "WALLET_FIRST_EXACT_SHORTFALL_NO_BONUS_SUPER_ACCOUNT_ONLY_OK\n";

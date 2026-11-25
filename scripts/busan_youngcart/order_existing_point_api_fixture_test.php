<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/existing-point-order-store.php';
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
$db->exec('ALTER TABLE g5_member ENGINE=MyISAM');
$db->exec('ALTER TABLE g5_point ENGINE=MyISAM');
define('_GNUBOARD_',true);define('G5_TIME_YMD',date('Y-m-d'));define('G5_TIME_YMDHIS',date('Y-m-d H:i:s'));define('G5_SERVER_TIME',time());
$config=['cf_use_point'=>1,'cf_point_term'=>0];$g5=['member_table'=>'g5_member','point_table'=>'g5_point'];$is_admin='';
function sql_query($sql,$show=true){return $GLOBALS['db']->query($sql);}
function sql_fetch($sql,$show=true){return sql_query($sql,$show)->fetch(PDO::FETCH_ASSOC);}
function sql_fetch_array($rs){return $rs->fetch(PDO::FETCH_ASSOC);}
function sql_real_escape_string($v){return substr($GLOBALS['db']->quote($v),1,-1);}
require __DIR__.'/order_existing_native_functions_fixture.php';
function ckExisting($ok,string $label):void{if(!$ok)throw new RuntimeException($label);}
function rejectExisting(callable $fn,string $type):void{try{$fn();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}throw new RuntimeException('expected rejection');}
function seedExisting(PDO $db,string $member):void{
    $db->prepare("INSERT INTO g5_member SET mb_id=?,mb_point=0,mb_signature='',mb_memo='',mb_profile='',mb_lost_certify=''")->execute([$member]);
    ckExisting(insert_point($member,1000,'fixture opening points','@fixture',$member,'seed')===1,'native seed');
}
seedExisting($db,'api_alice');seedExisting($db,'api_pending');
$db->exec("INSERT INTO yc5_category SET ca_id='x1',ca_name='API fixture',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
$item=str_repeat('8',20);
$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='x1',it_name='API fixture',it_price=300,it_stock_qty=5,it_use=1,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''")->execute([$item]);
$cart='123456789012397';$pending='123456789012396';
$nativeCart=new BusanNativeCart($db);$nativeCart->set('api_alice',$cart,$item,1);$nativeCart->set('api_pending',$pending,$item,1);
$points=BusanExistingPoints::native();$s=new BusanPointOrderSettlement($points,new BusanExistingPointOrderStore($db));
$req=str_repeat('c',32);$req2=str_repeat('d',32);
$stock=fn()=>(int)$db->query("SELECT it_stock_qty FROM yc5_item WHERE it_id='$item'")->fetchColumn();
$events=fn($m)=>(int)$db->query("SELECT COUNT(*) FROM g5_point WHERE mb_id=".$db->quote($m)." AND po_rel_table='@bpz-order'")->fetchColumn();
$r=$s->purchase('api_alice',$cart,$req);
ckExisting($r['state']==='paid'&&$points->balance('api_alice')===700&&$events('api_alice')===1&&$stock()===4,'native purchase');
ckExisting($s->purchase('api_alice',$cart,$req)===$r&&$events('api_alice')===1,'no duplicate debit');
rejectExisting(fn()=>$s->cancel('api_pending',$cart),DomainException::class);
$c=$s->cancel('api_alice',$cart);
ckExisting($c['state']==='cancelled'&&$points->balance('api_alice')===1000&&$events('api_alice')===2&&$stock()===5,'native refund');
ckExisting($s->cancel('api_alice',$cart)===$c&&$events('api_alice')===2,'no duplicate refund');
$db->exec("CREATE TRIGGER bpz_api_fail_finalize BEFORE UPDATE ON bpz_order_receipt FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture finalization failure'");
rejectExisting(fn()=>$s->purchase('api_pending',$pending,$req2),PDOException::class);
$db->exec('DROP TRIGGER bpz_api_fail_finalize');
ckExisting($points->balance('api_pending')===700&&$events('api_pending')===1&&$stock()===4,'debit survives shop failure and stock held');
rejectExisting(fn()=>$s->purchase('api_pending',$pending,$req2),RuntimeException::class);
ckExisting($events('api_pending')===1&&$points->balance('api_pending')===700,'pending never replayed');
$state=json_decode($db->query("SELECT receipt FROM bpz_order_receipt WHERE order_id='$pending'")->fetchColumn(),true);
ckExisting($state['state']==='debit_pending','durable pending evidence');
$engines=$db->query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('g5_member','g5_point')")->fetchAll(PDO::FETCH_KEY_PAIR);
ckExisting($engines===['g5_member'=>'MyISAM','g5_point'=>'MyISAM']||($engines['g5_member']==='MyISAM'&&$engines['g5_point']==='MyISAM'),'native engines unchanged during checkout');
echo "BUSAN_EXISTING_POINT_API_MYISAM_OK\n";

<?php
declare(strict_types=1);
require __DIR__.'/order_sql_fixture_port.php';
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
function nativeCheck($v,string $label):void{if(!$v)throw new RuntimeException($label);}
function nativeReject(callable $f,string $label,string $type=DomainException::class):void{
    try{$f();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}throw new RuntimeException($label);
}
function nativeScalar(PDO $db,string $sql,array $args=[]):int{$s=$db->prepare($sql);$s->execute($args);return (int)$s->fetchColumn();}
$db->exec("INSERT INTO g5_member SET mb_id='native_alice',mb_point=500,mb_signature='',mb_memo='',mb_profile='',mb_lost_certify=''");
$db->exec("INSERT INTO g5_member SET mb_id='native_bad',mb_point=100,mb_signature='',mb_memo='',mb_profile='',mb_lost_certify=''");
$today=new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul'));
$first=$today->modify('+7 days')->format('Y-m-d');$second=$today->modify('+30 days')->format('Y-m-d');
$seed=$db->prepare("INSERT INTO g5_point (mb_id,po_datetime,po_content,po_point,po_expire_date,po_mb_point) VALUES ('native_alice',NOW(),'fixture',?,?,?)");
$seed->execute([150,$first,150]);$seed->execute([350,$second,500]);
$ids=$db->query("SELECT po_id FROM g5_point WHERE mb_id='native_alice' ORDER BY po_id")->fetchAll(PDO::FETCH_COLUMN);
$native=new BusanNativePointLedger($db,30);
$p=new BusanSqlFixturePort($db,$native);$service=new BusanOrderLifecycle($p);
$id=str_repeat('f',20);$cart='123456789012399';
$db->exec("INSERT INTO yc5_category SET ca_id='n1',ca_name='native fixture',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='n1',it_name='native fixture',it_price=100,it_stock_qty=5,it_use=1,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''")->execute([$id]);
(new BusanNativeCart($db))->set('native_alice',$cart,$id,2);
$r=['csrf'=>'token','method'=>'POINT','request_id'=>str_repeat('a',32)];$c=['csrf'=>'token'];
$bal=fn()=>nativeScalar($db,"SELECT mb_point FROM g5_member WHERE mb_id='native_alice'");
$sum=fn()=>nativeScalar($db,"SELECT SUM(po_point) FROM g5_point WHERE mb_id='native_alice'");
$used=fn()=>nativeScalar($db,"SELECT SUM(po_use_point) FROM g5_point WHERE mb_id='native_alice'");
$events=fn()=>nativeScalar($db,"SELECT COUNT(*) FROM g5_point WHERE mb_id='native_alice' AND po_rel_table='@bpz-order'");
nativeReject(fn()=>$native->lockBalance('native_alice'),'outside transaction');
$db->beginTransaction();
nativeReject(fn()=>$native->lockBalance('native_bad'),'mismatch blocked');$db->rollBack();
$p->failAfterDebit=true;
nativeReject(fn()=>$service->purchase('native_alice',$cart,'token',$r),'native debit rollback',RuntimeException::class);
nativeCheck($bal()===500&&$sum()===500&&$used()===0&&$events()===0,'native rollback all');
$p->failAfterDebit=false;
$receipt=$service->purchase('native_alice',$cart,'token',$r);
nativeCheck($bal()===300&&$sum()===300&&$used()===200&&$events()===1,'native debit');
nativeCheck($receipt['native_debit']['allocations']=== [['po_id'=>(int)$ids[0],'amount'=>150,'expiry'=>$first],['po_id'=>(int)$ids[1],'amount'=>50,'expiry'=>$second]],'native expiry order');
nativeCheck($service->purchase('native_alice',$cart,'token',$r)===$receipt&&$events()===1,'native debit replay');
$p->failAfterReversal=true;
nativeReject(fn()=>$service->cancel('native_alice',$cart,'token',$c),'native reversal rollback',RuntimeException::class);
nativeCheck($bal()===300&&$sum()===300&&$events()===1,'native reversal rollback');
$p->failAfterReversal=false;
$refund=$service->cancel('native_alice',$cart,'token',$c);
nativeCheck($refund['returned_points']===200&&$bal()===500&&$sum()===500&&$used()===200&&$events()===3,'native exact credit, no double availability');
nativeCheck($service->cancel('native_alice',$cart,'token',$c)===$refund&&$events()===3,'native reversal replay');
$credits=$db->query("SELECT po_point,po_expire_date FROM g5_point WHERE mb_id='native_alice' AND po_rel_table='@bpz-order' AND po_point>0 ORDER BY po_id")->fetchAll(PDO::FETCH_ASSOC);
nativeCheck(count($credits)===2&&(int)$credits[0]['po_point']===150&&$credits[0]['po_expire_date']===$first&&(int)$credits[1]['po_point']===50&&$credits[1]['po_expire_date']===$second,'refund expiry preserved');
$db->beginTransaction();nativeCheck($native->lockBalance('native_alice')===500,'native balance and spendable lots reconciled');$db->rollBack();
nativeCheck(nativeScalar($db,"SELECT COUNT(*) FROM bpz_fixture_member WHERE mb_id='native_alice'")===0,'no second balance');
nativeCheck(nativeScalar($db,"SELECT COUNT(*) FROM bpz_fixture_ledger WHERE member_id='native_alice'")===0,'no second point ledger');
$db->exec('ALTER TABLE g5_point ENGINE=MyISAM');
nativeReject(fn()=>$service->purchase('native_alice',$cart,'token',$r),'native MyISAM blocked');
echo "BUSAN_NATIVE_SHARED_LEDGER_FIXTURE_OK\n";

<?php
declare(strict_types=1);
// Only synthetic products and synthetic members in the disposable CI database.
require __DIR__.'/../../deploy/busan/youngcart/existing-point-order-store.php';
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
require __DIR__.'/../../deploy/busan/youngcart/pointzone-activities.php';
require __DIR__.'/../../deploy/busan/youngcart/pointzone-activity-settlement.php';
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
define('_GNUBOARD_',true);define('G5_TIME_YMD',date('Y-m-d'));define('G5_TIME_YMDHIS',date('Y-m-d H:i:s'));define('G5_SERVER_TIME',time());
$config=['cf_use_point'=>1,'cf_point_term'=>0];$g5=['member_table'=>'g5_member','point_table'=>'g5_point'];
$is_member=true;$is_admin='super';$member=['mb_id'=>'sample_buyer','mb_leave_date'=>'','mb_intercept_date'=>''];
function sql_query($sql,$show=true){return $GLOBALS['db']->query($sql);}
function sql_fetch($sql,$show=true){return sql_query($sql,$show)->fetch(PDO::FETCH_ASSOC);}
function sql_fetch_array($r){return $r->fetch(PDO::FETCH_ASSOC);}
function sql_real_escape_string($v){return substr($GLOBALS['db']->quote($v),1,-1);}
require __DIR__.'/order_existing_native_functions_fixture.php';
require __DIR__.'/../../deploy/busan/youngcart/theme/Busan_PointZone/lib/order-views.php';
function sampleCheck(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);}
function sampleReject(callable $f):void{try{$f();}catch(DomainException $e){return;}throw new RuntimeException('expected rejection');}
$items=[
 ['id'=>'f1000000000000000001','name'=>'[샘플] 부산지부 머그컵','price'=>500,'stock'=>10,'desc'=>'일반 상품 · 구매 및 취소 검증'],
 ['id'=>'f1000000000000000002','name'=>'[샘플] 부산지부 우산','price'=>800,'stock'=>3,'desc'=>'복수 상품 주문 검증'],
 ['id'=>'f1000000000000000003','name'=>'[샘플] 오션블루 프로필 테두리','price'=>200,'stock'=>20,'desc'=>'30일 기간제 꾸미기'],
 ['id'=>'f1000000000000000004','name'=>'[샘플] 부산지부 명예 배지','price'=>300,'stock'=>20,'desc'=>'영구 소장 꾸미기'],
 ['id'=>'f1000000000000000005','name'=>'[샘플] 한정 기념품','price'=>1000,'stock'=>1,'desc'=>'마지막 재고 검증'],
 ['id'=>'f1000000000000000006','name'=>'[샘플] 품절 상품','price'=>100,'stock'=>0,'desc'=>'재고 부족 검증'],
 ['id'=>'f1000000000000000007','name'=>'[샘플] 고가 상품','price'=>9000,'stock'=>2,'desc'=>'포인트 부족 검증']
];
$db->exec("INSERT INTO yc5_category SET ca_id='z9',ca_name='[샘플] POINT ZONE 테스트',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
$insert=$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='z9',it_name=?,it_price=?,it_stock_qty=?,it_use=1,it_basic=?,it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''");
foreach($items as $p)$insert->execute([$p['id'],$p['name'],$p['price'],$p['stock'],$p['desc']]);
foreach(['sample_buyer','sample_other'] as $id){
    $db->prepare("INSERT INTO g5_member SET mb_id=?,mb_point=0,mb_signature='',mb_memo='',mb_profile='',mb_lost_certify=''")->execute([$id]);
    sampleCheck(insert_point($id,5000,'fixture opening balance','@fixture',$id,'seed')===1,'seed');
}
$points=BusanExistingPoints::native();$cart=new BusanNativeCart($db);$order=new BusanPointOrderSettlement($points,new BusanExistingPointOrderStore($db));
$activities=new BusanPointZoneActivities($db);$settle=new BusanActivitySettlement($db);
$stock=function($id)use($db){$q=$db->prepare('SELECT it_stock_qty FROM yc5_item WHERE it_id=?');$q->execute([$id]);return (int)$q->fetchColumn();};
$visible=array_column(BusanOrderViews::catalog(),'it_id');
foreach($items as $p)sampleCheck(in_array($p['id'],$visible,true),'catalog sample visible');
$m='sample_buyer';$o='123456789012390';
$cart->set($m,$o,$items[0]['id'],2);$cart->set($m,$o,$items[1]['id'],1);
$r=$order->purchase($m,$o,str_repeat('a',32));
sampleCheck($r['amount']===1800&&$points->balance($m)===3200&&$stock($items[0]['id'])===8&&$stock($items[1]['id'])===2,'multiple products purchase');
sampleCheck($order->purchase($m,$o,str_repeat('a',32))===$r,'purchase replay');
$order->cancel($m,$o);sampleCheck($points->balance($m)===5000&&$stock($items[0]['id'])===10&&$stock($items[1]['id'])===3,'full refund and stock');
foreach([2,3] as $i){
    $id=$items[$i]['id'];$oid='12345678901238'.$i;
    $profile=$activities->saveDraft(['kind'=>'profile','title'=>$items[$i]['name'],'description'=>$items[$i]['desc'],'opens_at'=>'2020-01-01 00:00:00','duration_days'=>$i===2?30:0,'item_id'=>$id]);
    $settle->publish($profile['id']);
    $cart->set($m,$oid,$id,1);$order->purchase($m,$oid,str_repeat((string)$i,32));
    $e=$activities->claimProfile($profile['id'],$oid);
    sampleCheck(($e['expires_at']===null)===($i===3),'temporary/permanent duration');
    $activities->equip($e['id']);sampleCheck($activities->equipped()['id']===$e['id'],'profile selection');
    if($i===2){
        $db->prepare('UPDATE bpz_entitlement SET expires_at=? WHERE id=?')->execute(['2020-01-01 00:00:00',$e['id']]);
        sampleCheck($activities->equipped()===null,'expired selection');
        sampleReject(fn()=>$activities->equip($e['id']));
    }
    $order->cancel($m,$oid);sampleCheck($activities->equipped()===null,'cancel selection');
}
$last='123456789012384';
$cart->set($m,$last,$items[4]['id'],1);$order->purchase($m,$last,str_repeat('4',32));
sampleCheck($stock($items[4]['id'])===0,'last item sold');
sampleReject(fn()=>$cart->set('sample_other','123456789012385',$items[4]['id'],1));
$order->cancel($m,$last);sampleCheck($stock($items[4]['id'])===1,'last item returned');
sampleReject(fn()=>$cart->set($m,'123456789012386',$items[5]['id'],1));
$before=$points->balance($m);
$cart->set($m,'123456789012387',$items[6]['id'],1);
sampleReject(fn()=>$order->purchase($m,'123456789012387',str_repeat('7',32)));
sampleCheck($points->balance($m)===$before&&$stock($items[6]['id'])===2,'insufficient balance no mutation');
sampleCheck($points->balance($m)===5000&&$points->balance('sample_other')===5000,'synthetic balances fully restored');
echo "BUSAN_POINTZONE_SAMPLE_PRODUCTS_OK count=7 native_points_restored=2\n";

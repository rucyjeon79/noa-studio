<?php
declare(strict_types=1);
/* Runs after the isolated native order integration suite. */
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if($db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new RuntimeException('wrong database');
define('_GNUBOARD_',true);
function sql_query($sql,$show=false){
    if(!preg_match('/^SELECT\s/i',$sql))throw new RuntimeException('read-only query expected');
    return $GLOBALS['db']->query($sql);
}
function sql_fetch_array($rs){return $rs->fetch(PDO::FETCH_ASSOC);}
function sql_real_escape_string($v){return substr($GLOBALS['db']->quote($v),1,-1);}
require __DIR__.'/../../deploy/busan/youngcart/theme/Busan_PointZone/lib/order-views.php';
function ckView(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);}
function deniedView(callable $f):void{try{$f();}catch(DomainException $e){return;}throw new RuntimeException('authorization unexpectedly granted');}
$is_member=true;$is_admin='';$member=['mb_id'=>'alice','mb_leave_date'=>'','mb_intercept_date'=>''];
$orders=BusanOrderViews::orders();
ckView(count($orders)===1 && (string)$orders[0]['od_id']==='123456789012345','own orders only');
ckView(!array_key_exists('mb_id',$orders[0]),'member projection omits identifier');
deniedView(fn()=>BusanOrderViews::orders(true));
$member['mb_id']="alice' OR 1=1 --";
ckView(BusanOrderViews::orders()===[],'escaped member identifier');
$member['mb_id']='alice';$is_admin='super';
$all=BusanOrderViews::orders(true);
ckView(count($all)>1 && count(array_filter($all,fn($r)=>$r['mb_id']==='alice'))===1,'administrator projection');
$is_admin='';$member['mb_intercept_date']='20261125';
deniedView(fn()=>BusanOrderViews::catalog());deniedView(fn()=>BusanOrderViews::orders());
$member['mb_intercept_date']='';$is_member=false;deniedView(fn()=>BusanOrderViews::orders());
$is_member=true;
$id=str_repeat('e',20);
$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='a1',it_name='hidden fixture',it_price=100,it_stock_qty=5,it_use=0,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''")->execute([$id]);
$catalog=BusanOrderViews::catalog();
ckView(count($catalog)>0 && !in_array($id,array_column($catalog,'it_id'),true),'draft item excluded');
$db->exec("UPDATE yc5_category SET ca_use=0 WHERE ca_id='a1'");
ckView(BusanOrderViews::catalog()===[],'hidden category excluded');
ckView(BusanOrderViews::status('취소')==='취소','cancelled label');
echo "BUSAN_ORDER_VIEW_FIXTURE_OK\n";

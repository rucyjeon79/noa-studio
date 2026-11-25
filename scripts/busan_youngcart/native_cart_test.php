<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
require __DIR__.'/../../deploy/busan/youngcart/checkout-readiness.php';
function check($v,string $msg):void{if(!$v)throw new RuntimeException($msg);}
function reject(callable $f,string $msg):void{try{$f();}catch(DomainException $e){return;}throw new RuntimeException($msg);}
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture-only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
check($db->query('SELECT DATABASE()')->fetchColumn()==='pointzone_fixture','fixture database');
$id=str_repeat('a',20);$cart='123456789012345';$member='fixture_member';
$db->exec("INSERT INTO yc5_category SET ca_id='a1',ca_name='fixture',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
$s=$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='a1',it_name='fixture',it_price=100,it_stock_qty=5,it_use=1,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''");
$s->execute([$id]);
$c=new BusanNativeCart($db);
$c->set($member,$cart,$id,2);
$c->set($member,$cart,$id,3);
check((int)$db->query('SELECT COUNT(*) FROM yc5_cart')->fetchColumn()===1,'repeat update no duplicate');
check($c->quote($member,$cart,500)['total_points']===300,'quote');
reject(fn()=>$c->quote('other_member',$cart,500),'foreign quote');
reject(fn()=>$c->remove('other_member',$cart,$id),'foreign delete');
reject(fn()=>$c->set('other_member',$cart,$id,1),'foreign update');
reject(fn()=>$c->set($member,$cart,$id,6),'oversell rejected');
reject(fn()=>$c->quote($member,$cart,299),'insufficient points');
$db->exec("UPDATE yc5_cart SET ct_price=1");
$db->exec("UPDATE yc5_item SET it_price=120");
check($c->quote($member,$cart,500)['total_points']===360,'server repricing ignores cart price');
$db->exec("UPDATE yc5_item SET it_use=0");
reject(fn()=>$c->quote($member,$cart,500),'hidden item rejected');
$db->exec("UPDATE yc5_item SET it_use=1,it_sc_price=10");
reject(fn()=>$c->quote($member,$cart,500),'unconfigured shipping rejected');
$db->exec("UPDATE yc5_item SET it_sc_price=0");
$c->remove($member,$cart,$id);
check((int)$db->query('SELECT COUNT(*) FROM yc5_cart')->fetchColumn()===0,'remove');
reject(fn()=>$c->quote($member,$cart,500),'empty cart rejected');
reject(fn()=>BusanCheckoutReadiness::requireAtomicStorage(['member'=>'MyISAM','point'=>'MyISAM','cart'=>'InnoDB','item'=>'InnoDB','order'=>'InnoDB']),'nontransactional ledger blocked');
reject(fn()=>BusanCheckoutReadiness::liveCheckout(),'live checkout remains closed');
check((int)$db->query('SELECT COUNT(*) FROM yc5_order')->fetchColumn()===0,'no order written');
echo "BUSAN_NATIVE_CART_FIXTURE_OK\n";

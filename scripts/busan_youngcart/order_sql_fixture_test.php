<?php
declare(strict_types=1);
require __DIR__.'/order_sql_fixture_port.php';
require __DIR__.'/../../deploy/busan/youngcart/native-cart.php';
function ck($ok,string $s):void{if(!$ok)throw new RuntimeException($s);}
function rejects(callable $f,string $s,string $type=DomainException::class):void{
    try{$f();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}throw new RuntimeException($s);
}
if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture')throw new RuntimeException('fixture only');
$db=new PDO('mysql:host=127.0.0.1;port=3306;dbname=pointzone_fixture;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
$p=new BusanSqlFixturePort($db);$s=new BusanOrderLifecycle($p);
$db->exec("INSERT INTO bpz_fixture_member VALUES ('alice',500),('bob',500)");
$db->exec("INSERT INTO yc5_category SET ca_id='a1',ca_name='fixture',ca_use=1,ca_head_html='',ca_tail_html='',ca_mobile_head_html='',ca_mobile_tail_html=''");
$id=str_repeat('a',20);$cart='123456789012345';
$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='a1',it_name='fixture',it_price=100,it_stock_qty=5,it_use=1,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''")->execute([$id]);
(new BusanNativeCart($db))->set('alice',$cart,$id,2);
$r=['csrf'=>'token','method'=>'POINT','request_id'=>str_repeat('1',32)];
$c=['csrf'=>'token'];
$balance=fn()=>(int)$db->query("SELECT balance FROM bpz_fixture_member WHERE mb_id='alice'")->fetchColumn();
$stock=fn()=>(int)$db->query('SELECT it_stock_qty FROM yc5_item')->fetchColumn();
$count=fn($table)=>(int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn();
$p->failAfterDebit=true;
rejects(fn()=>$s->purchase('alice',$cart,'token',$r),'purchase failure',RuntimeException::class);
ck($balance()===500&&$stock()===5&&$count('bpz_fixture_ledger')===0&&$count('bpz_fixture_request')===0&&$count('yc5_order')===0,'debit rollback');
$p->failAfterDebit=false;
$db->exec('UPDATE yc5_item SET it_price=120');
$receipt=$s->purchase('alice',$cart,'token',$r);
ck($receipt['debited_points']===240&&$balance()===260&&$stock()===3&&$count('yc5_order')===1,'purchase and server reprice');
ck($s->purchase('alice',$cart,'token',$r)===$receipt&&$count('bpz_fixture_ledger')===1,'purchase replay');
rejects(fn()=>$s->purchase('bob',$cart,'token',$r),'foreign replay');
rejects(fn()=>$s->cancel('bob',$cart,'token',$c),'foreign cancellation');
$p->failAfterReversal=true;
rejects(fn()=>$s->cancel('alice',$cart,'token',$c),'cancel failure',RuntimeException::class);
ck($balance()===260&&$stock()===3&&$count('bpz_fixture_ledger')===1,'reversal rollback');
$p->failAfterReversal=false;
$refund=$s->cancel('alice',$cart,'token',$c);
ck($refund['returned_points']===240&&$balance()===500&&$stock()===5,'full reversal');
ck($s->cancel('alice',$cart,'token',$c)===$refund&&$count('bpz_fixture_ledger')===2&&$balance()===500,'cancel replay');
ck($db->query('SELECT od_status FROM yc5_order')->fetchColumn()==='취소','native order status');
ck($db->query('SELECT ct_status FROM yc5_cart')->fetchColumn()==='취소','native cart status');
$db->exec('ALTER TABLE bpz_fixture_member MODIFY mb_id VARCHAR(191) NOT NULL, ENGINE=MyISAM');
rejects(fn()=>$s->purchase('alice',$cart,'token',$r),'MyISAM blocked');
echo "BUSAN_ORDER_SQL_FIXTURE_OK\n";

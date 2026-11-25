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

if(($argv[1]??'')==='race-worker'){
    if(count($argv)!==6)throw new RuntimeException('invalid worker args');
    [$script,$mode,$action,$member,$cart,$requestId]=$argv;
    echo "READY\n";flush();
    if(trim((string)fgets(STDIN))!=='GO')throw new RuntimeException('missing barrier');
    for($attempt=0;$attempt<3;$attempt++){
        try{
            $result=$action==='purchase'
                ?$s->purchase($member,$cart,'token',['csrf'=>'token','method'=>'POINT','request_id'=>$requestId])
                :$s->cancel($member,$cart,'token',['csrf'=>'token']);
            echo json_encode(['status'=>'ok','receipt'=>$result],JSON_THROW_ON_ERROR)."\n";exit(0);
        }catch(DomainException $e){
            echo json_encode(['status'=>'rejected','reason'=>$e->getMessage()],JSON_THROW_ON_ERROR)."\n";exit(0);
        }catch(PDOException $e){
            if(!in_array((int)($e->errorInfo[1]??0),[1205,1213],true)||$attempt===2)throw $e;
            usleep(25000*($attempt+1));
        }
    }
    throw new RuntimeException('retry exhausted');
}
function racePair(array $a,array $b):array{
    $workers=[];
    try{
        foreach([$a,$b] as $args){
            $process=proc_open(array_merge([PHP_BINARY,__FILE__,'race-worker'],$args),[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
            if(!is_resource($process))throw new RuntimeException('worker start');
            $workers[]=[$process,$pipes];
            stream_set_timeout($pipes[1],20);
        }
        foreach($workers as [$proc,$pipes]){
            if(trim((string)fgets($pipes[1]))!=='READY')throw new RuntimeException('worker barrier');
        }
        foreach($workers as [$proc,$pipes]){fwrite($pipes[0],"GO\n");fflush($pipes[0]);}
        $results=[];
        foreach($workers as [$proc,$pipes]){
            $line=fgets($pipes[1]);
            $r=json_decode((string)$line,true,512,JSON_THROW_ON_ERROR);
            if(!in_array($r['status']??null,['ok','rejected'],true))throw new RuntimeException('invalid worker result');
            $results[]=$r;
        }
        return $results;
    }finally{
        foreach($workers as [$proc,$pipes]){
            foreach($pipes as $pipe)if(is_resource($pipe))fclose($pipe);
            if(is_resource($proc)){proc_terminate($proc);proc_close($proc);}
        }
    }
}
function scalarFixture(PDO $db,string $sql,array $args=[]):int{
    $q=$db->prepare($sql);$q->execute($args);return (int)$q->fetchColumn();
}

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

// Restore only the disposable test table before multi-connection tests.
$db->exec('ALTER TABLE bpz_fixture_member ENGINE=InnoDB');
$db->exec("INSERT INTO bpz_fixture_member VALUES ('race_balance',100),('race_duplicate',500),('race_stock_a',500),('race_stock_b',500)");
$cartService=new BusanNativeCart($db);
$create=$db->prepare("INSERT INTO yc5_item SET it_id=?,ca_id='a1',it_name='race fixture',it_price=100,it_stock_qty=?,it_use=1,it_basic='',it_explan='',it_explan2='',it_mobile_explan='',it_head_html='',it_tail_html='',it_mobile_head_html='',it_mobile_tail_html='',it_info_value='',it_use_avg=0,it_shop_memo=''");
$balanceItem=str_repeat('b',20);$duplicateItem=str_repeat('c',20);$stockItem=str_repeat('d',20);
$create->execute([$balanceItem,10]);$create->execute([$duplicateItem,3]);$create->execute([$stockItem,1]);
$cartService->set('race_balance','123456789012351',$balanceItem,1);
$cartService->set('race_balance','123456789012352',$balanceItem,1);
$out=racePair(['purchase','race_balance','123456789012351',str_repeat('2',32)],['purchase','race_balance','123456789012352',str_repeat('3',32)]);
ck(count(array_filter($out,fn($x)=>$x['status']==='ok'))===1,'concurrent balance: one accepted');
ck(scalarFixture($db,'SELECT balance FROM bpz_fixture_member WHERE mb_id=?',['race_balance'])===0,'concurrent balance no overspend');
ck(scalarFixture($db,'SELECT COUNT(*) FROM bpz_fixture_ledger WHERE member_id=?',['race_balance'])===1,'one debit');
ck(scalarFixture($db,'SELECT it_stock_qty FROM yc5_item WHERE it_id=?',[$balanceItem])===9,'single reservation');
$cartService->set('race_duplicate','123456789012353',$duplicateItem,1);
$req=str_repeat('4',32);
$out=racePair(['purchase','race_duplicate','123456789012353',$req],['purchase','race_duplicate','123456789012353',$req]);
ck($out[0]['status']==='ok'&&$out[1]['status']==='ok'&&$out[0]['receipt']===$out[1]['receipt'],'concurrent request replay');
ck(scalarFixture($db,'SELECT balance FROM bpz_fixture_member WHERE mb_id=?',['race_duplicate'])===400,'duplicate single debit');
$out=racePair(['cancel','race_duplicate','123456789012353',$req],['cancel','race_duplicate','123456789012353',$req]);
ck($out[0]['status']==='ok'&&$out[1]['status']==='ok'&&$out[0]['receipt']===$out[1]['receipt'],'concurrent cancellation replay');
ck(scalarFixture($db,'SELECT balance FROM bpz_fixture_member WHERE mb_id=?',['race_duplicate'])===500,'duplicate cancellation single refund');
ck(scalarFixture($db,'SELECT COUNT(*) FROM bpz_fixture_ledger WHERE member_id=?',['race_duplicate'])===2,'exactly one debit and reversal');
ck(scalarFixture($db,'SELECT it_stock_qty FROM yc5_item WHERE it_id=?',[$duplicateItem])===3,'stock restored once');
$cartService->set('race_stock_a','123456789012354',$stockItem,1);
$cartService->set('race_stock_b','123456789012355',$stockItem,1);
$out=racePair(['purchase','race_stock_a','123456789012354',str_repeat('5',32)],['purchase','race_stock_b','123456789012355',str_repeat('6',32)]);
ck(count(array_filter($out,fn($x)=>$x['status']==='ok'))===1,'last stock: one accepted');
ck(scalarFixture($db,'SELECT it_stock_qty FROM yc5_item WHERE it_id=?',[$stockItem])===0,'stock never negative');
ck(scalarFixture($db,"SELECT SUM(balance) FROM bpz_fixture_member WHERE mb_id IN ('race_stock_a','race_stock_b')")===900,'one stock debit');
echo "BUSAN_ORDER_SQL_CONCURRENCY_OK\n";

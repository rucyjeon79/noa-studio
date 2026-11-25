<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/order-lifecycle.php';

// In-memory transaction-port contract test, not a database or live ledger test.
final class FixtureOrderPort implements BusanOrderTransactionPort {
    public array $balances=['alice'=>500,'bob'=>500], $requests=[], $orders=[], $carts=[];
    public int $stock=5;
    public bool $fail=false;
    public function atomic(callable $work):array{
        $snapshot=[$this->balances,$this->requests,$this->orders,$this->carts,$this->stock];
        try{return $work();}catch(Throwable $e){
            [$this->balances,$this->requests,$this->orders,$this->carts,$this->stock]=$snapshot;
            throw $e;
        }
    }
    public function lockRequest(string $requestId):?array{return $this->requests[$requestId]??null;}
    public function lockMemberBalance(string $member):int{
        if(!isset($this->balances[$member]))throw new DomainException('member');
        return $this->balances[$member];
    }
    public function lockCartLines(string $member,string $cart):array{
        if(($this->carts[$cart]??null)!==$member)throw new DomainException('cart');
        return [['item'=>str_repeat('a',20),'price'=>100,'qty'=>2,'stock'=>$this->stock]];
    }
    public function writePurchase(string $member,string $cart,string $requestId,array $lines,int $total):array{
        $this->balances[$member]-=$total;$this->stock-=$lines[0]['qty'];
        if($this->fail)throw new RuntimeException('fixture write failed');
        unset($this->carts[$cart]);
        $r=['member'=>$member,'cart'=>$cart,'order'=>$cart,'debited_points'=>$total,'debit_id'=>$requestId,'state'=>'paid','fulfilled'=>false];
        $this->orders[$cart]=$r;
        return $this->requests[$requestId]=$r;
    }
    public function lockOrder(string $member,string $order):?array{
        $r=$this->orders[$order]??null;
        return ($r['member']??null)===$member?$r:null;
    }
    public function writeCancellation(array $order):array{
        $this->balances[$order['member']]+=$order['debited_points'];$this->stock+=2;
        if($this->fail)throw new RuntimeException('fixture refund failed');
        $id=$order['order'];
        $receipt=['order'=>$id,'returned_points'=>$order['debited_points'],'state'=>'cancelled'];
        $this->orders[$id]['state']='cancelled';
        $this->orders[$id]['cancellation_receipt']=$receipt;
        return $receipt;
    }
}
function checkOrder($ok,string $label):void{if(!$ok)throw new RuntimeException($label);}
function rejectOrder(callable $f,string $label,string $type=DomainException::class):void{
    try{$f();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}
    throw new RuntimeException($label);
}
$p=new FixtureOrderPort();$service=new BusanOrderLifecycle($p);
$cart='123456789012345';$other='123456789012346';
$p->carts=[$cart=>'alice',$other=>'alice'];
$r=['csrf'=>'token','method'=>'POINT','request_id'=>str_repeat('1',32)];
$cancel=['csrf'=>'token'];
rejectOrder(fn()=>$service->purchase('alice',$cart,'wrong',$r),'csrf');
rejectOrder(fn()=>$service->purchase('alice',$cart,'token',array_replace($r,['method'=>'CARD'])),'cash method');
rejectOrder(fn()=>$service->purchase('alice',$cart,'token',$r+['amount'=>1]),'client amount');
$p->balances['alice']=199;
rejectOrder(fn()=>$service->purchase('alice',$cart,'token',$r),'insufficient');
$p->balances['alice']=500;$p->stock=1;
rejectOrder(fn()=>$service->purchase('alice',$cart,'token',$r),'stock');
$p->stock=5;$p->fail=true;
rejectOrder(fn()=>$service->purchase('alice',$cart,'token',$r),'rollback',RuntimeException::class);
checkOrder($p->balances['alice']===500&&$p->stock===5&&!$p->orders&&!$p->requests,'purchase rollback');
$p->fail=false;
$receipt=$service->purchase('alice',$cart,'token',$r);
checkOrder($p->balances['alice']===300&&$p->stock===3&&count($p->orders)===1,'purchase');
checkOrder($service->purchase('alice',$cart,'token',$r)===$receipt&&$p->balances['alice']===300,'retry');
rejectOrder(fn()=>$service->purchase('alice',$other,'token',$r),'request cart binding');
rejectOrder(fn()=>$service->purchase('bob',$cart,'token',$r),'request member binding');
rejectOrder(fn()=>$service->cancel('bob',$cart,'token',$cancel),'foreign order');
$p->orders[$cart]['fulfilled']=true;
rejectOrder(fn()=>$service->cancel('alice',$cart,'token',$cancel),'fulfilled order');
$p->orders[$cart]['fulfilled']=false;$p->fail=true;
rejectOrder(fn()=>$service->cancel('alice',$cart,'token',$cancel),'refund rollback',RuntimeException::class);
checkOrder($p->balances['alice']===300&&$p->stock===3&&$p->orders[$cart]['state']==='paid','refund rollback state');
$p->fail=false;$refund=$service->cancel('alice',$cart,'token',$cancel);
checkOrder($refund['returned_points']===200&&$p->balances['alice']===500&&$p->stock===5,'full reversal');
checkOrder($service->cancel('alice',$cart,'token',$cancel)===$refund&&$p->balances['alice']===500&&$p->stock===5,'duplicate refund');
echo "BUSAN_ORDER_LIFECYCLE_CONTRACT_OK\n";

<?php
declare(strict_types=1);
require_once __DIR__.'/existing-points.php';
/**
 * Youngcart order-side settlement. Native point calls are deliberately outside
 * shop SQL transactions. The order store must commit pending status BEFORE
 * a point API call, and commit completion only after verified point evidence.
 * An ambiguous pending operation is never automatically repeated.
 */
interface BusanPointOrderStore {
    public function serialized(string $member,callable $work):array;
    /** Atomically validate cart/price/stock and reserve a native order. */
    public function preparePurchase(string $member,string $cart,string $request,int $balance):array;
    /** Atomically finalize verified point debit, native order and cart. */
    public function finishPurchase(array $order,array $point):array;
    /** Atomically mark a paid unfulfilled order refund-pending. */
    public function prepareRefund(string $member,string $order):array;
    /** Atomically finalize verified point refund and restore stock. */
    public function finishRefund(array $order,array $point):array;
}
final class BusanPointOrderSettlement {
    public function __construct(private BusanExistingPoints $points,private BusanPointOrderStore $orders){}
    public function purchase(string $member,string $cart,string $request):array{
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member)||!preg_match('/^[1-9][0-9]{14}$/D',$cart)||!preg_match('/^[a-f0-9]{32}$/D',$request))
            throw new DomainException('invalid checkout identity');
        return $this->orders->serialized($member,function()use($member,$cart,$request){
            $o=$this->orders->preparePurchase($member,$cart,$request,$this->points->balance($member));
            if(($o['state']??'')==='paid')return $o;
            if(($o['state']??'')!=='new_debit_pending')throw new RuntimeException('pending order requires reconciliation');
            $point=$this->points->debit($member,$cart,$o['amount']);
            return $this->orders->finishPurchase($o,$point);
        });
    }
    public function cancel(string $member,string $order):array{
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member)||!preg_match('/^[1-9][0-9]{14}$/D',$order))
            throw new DomainException('invalid cancellation identity');
        return $this->orders->serialized($member,function()use($member,$order){
            $o=$this->orders->prepareRefund($member,$order);
            if(($o['state']??'')==='cancelled')return $o;
            if(($o['state']??'')!=='new_refund_pending')throw new RuntimeException('pending refund requires reconciliation');
            $point=$this->points->refund($member,$order,$o['amount'],$o['point_id']);
            return $this->orders->finishRefund($o,$point);
        });
    }
}

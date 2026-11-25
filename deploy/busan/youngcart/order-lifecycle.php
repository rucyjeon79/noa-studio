<?php
declare(strict_types=1);
require_once __DIR__.'/point-contract.php';

/**
 * Order orchestration only; not a live route or ledger adapter.
 * All methods must use ONE transactional connection. atomic() must reject
 * non-InnoDB storage, roll back every change on any Throwable, and retry
 * deadlocks only by rerunning the entire transaction. No external side effects.
 * Existing point writers (gift, posts, expiry, admin) must share the member
 * locking protocol before a production implementation can be enabled.
 */
interface BusanOrderTransactionPort {
    public function atomic(callable $work): array;
    // Persistently reserve/lock a globally unique request key, even if absent.
    // An existing receipt must be returned unchanged, with member and cart.
    public function lockRequest(string $requestId): ?array;
    public function lockMemberBalance(string $member): int;
    // Lock cart ownership and product rows in deterministic order; verify
    // server prices, stock, supported options and current cart state.
    public function lockCartLines(string $member,string $cart): array;
    // Create native order, debit original shared ledger, reserve stock, mark
    // cart ordered and persist request receipt in the same transaction.
    // Must use a unique debit per order and retain exact debit allocation.
    public function writePurchase(string $member,string $cart,string $requestId,array $lines,int $total): array;
    // Lock only the caller's order; return null if absent or foreign.
    public function lockOrder(string $member,string $order): ?array;
    // Restore original debit allocation/expiry and release reserved stock
    // exactly once; update native order/cart and persist cancellation receipt.
    // Must reject mismatched state and enforce unique reversal of the debit.
    public function writeCancellation(array $order): array;
}
final class BusanOrderLifecycle {
    public function __construct(private BusanOrderTransactionPort $port){}
    private static function authenticated(string $member,string $sessionCsrf,$supplied): void {
        if($member===''||strlen($member)>255||$sessionCsrf===''||
           !is_string($supplied)||!hash_equals($sessionCsrf,$supplied))
            throw new DomainException('authentication or csrf failed');
    }
    private static function nativeId(string $id): void {
        if(!preg_match('/^[1-9][0-9]{14}$/D',$id))throw new DomainException('invalid native id');
    }
    public function purchase(string $member,string $cart,string $sessionCsrf,array $request): array {
        self::authenticated($member,$sessionCsrf,$request['csrf']??null);
        self::nativeId($cart);
        BusanPointOnlyPolicy::authorize($request,1);
        $id=$request['request_id'];
        return $this->port->atomic(function()use($member,$cart,$id,$request){
            $prior=$this->port->lockRequest($id);
            if($prior!==null){
                if(($prior['member']??null)!==$member||($prior['cart']??null)!==$cart)
                    throw new DomainException('request binding conflict');
                return $prior;
            }
            $balance=$this->port->lockMemberBalance($member);
            $lines=$this->port->lockCartLines($member,$cart);
            $seen=[];
            foreach($lines as $line){
                $item=$line['item']??null;
                if(!is_string($item)||!preg_match('/^[a-f0-9]{20}$/D',$item)||isset($seen[$item]))
                    throw new DomainException('invalid or duplicate item');
                $seen[$item]=true;
            }
            $total=BusanPointOnlyPolicy::quote($lines,$balance);
            if($total>2147483647)throw new DomainException('native order amount overflow');
            BusanPointOnlyPolicy::authorize($request,$total);
            return $this->port->writePurchase($member,$cart,$id,$lines,$total);
        });
    }
    public function cancel(string $member,string $order,string $sessionCsrf,array $request): array {
        self::authenticated($member,$sessionCsrf,$request['csrf']??null);
        self::nativeId($order);
        if(array_keys($request)!==['csrf'])throw new DomainException('unexpected cancellation fields');
        return $this->port->atomic(function()use($member,$order){
            // Match the purchase lock protocol: member before native order.
            $this->port->lockMemberBalance($member);
            $current=$this->port->lockOrder($member,$order);
            if($current===null||($current['member']??null)!==$member||($current['order']??null)!==$order)
                throw new DomainException('order unavailable');
            if(($current['state']??null)==='cancelled'){
                if(!is_array($current['cancellation_receipt']??null))
                    throw new DomainException('missing cancellation evidence');
                return $current['cancellation_receipt'];
            }
            // Conservative development policy: only paid, unfulfilled orders.
            if(($current['state']??null)!=='paid'||($current['fulfilled']??null)!==false)
                throw new DomainException('order cannot be cancelled');
            $total=$current['debited_points']??null;
            if(!is_int($total)||$total<1||$total>2147483647||
               !is_string($current['debit_id']??null)||$current['debit_id']==='')
                throw new DomainException('missing original debit evidence');
            return $this->port->writeCancellation($current);
        });
    }
}

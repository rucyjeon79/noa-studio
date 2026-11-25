<?php
declare(strict_types=1);
/* POINT ZONE server-side policy. Pure checks; no production mutation.
 * Integration must recalculate all prices under DB locks from Youngcart rows.
 * Do not accept client-supplied money, discounts, shipping or balance.
 */
final class BusanPointOnlyPolicy {
    public const METHOD='POINT';
    public static function quote(array $lines,int $balance): int {
        if(!$lines||$balance<0)throw new DomainException('invalid cart or balance');
        $total=0;
        foreach($lines as $line){
            $price=$line['price']??null;$qty=$line['qty']??null;$stock=$line['stock']??null;
            if(!is_int($price)||$price<1||!is_int($qty)||$qty<1||!is_int($stock)||$stock<$qty)
                throw new DomainException('invalid price, quantity or stock');
            if($price>intdiv(PHP_INT_MAX-$total,$qty))throw new DomainException('overflow');
            $total+=$price*$qty;
        }
        if($total>$balance)throw new DomainException('insufficient points');
        return $total;
    }
    public static function authorize(array $request,int $verifiedTotal): void {
        if($verifiedTotal<1||($request['method']??null)!==self::METHOD)
            throw new DomainException('points only');
        // Exactly these fields; any PG method, amount override, coupon, cash,
        // charging or bank detail is rejected rather than ignored.
        $keys=array_keys($request);sort($keys);
        if($keys!==['csrf','method','request_id'])
            throw new DomainException('unexpected checkout fields');
        if(!is_string($request['csrf'])||$request['csrf']===''||
           !is_string($request['request_id'])||!preg_match('/^[a-f0-9]{32}$/D',$request['request_id']))
            throw new DomainException('invalid request');
    }
}

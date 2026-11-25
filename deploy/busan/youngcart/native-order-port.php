<?php
declare(strict_types=1);
require_once __DIR__.'/order-lifecycle.php';
require_once __DIR__.'/native-point-ledger.php';
require_once __DIR__.'/checkout-readiness.php';
/** Native order port candidate. No secondary balance table.
 * Production use deliberately blocked by checkout-readiness until all
 * existing point writers share a verified transaction/locking protocol.
 */
final class BusanNativeOrderPort implements BusanOrderTransactionPort {
    private BusanNativePointLedger $native;
    public function __construct(private PDO $db,int $pointTerm){
        if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture' ||
           $db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')
            BusanCheckoutReadiness::liveCheckout();
        $db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
        $this->native=new BusanNativePointLedger($db,$pointTerm);
    }
    private function q(string $sql,array $a=[]):PDOStatement{
        $s=$this->db->prepare($sql);$s->execute($a);return $s;
    }
    private function row(string $sql,array $a=[]):?array{
        $r=$this->q($sql,$a)->fetch(PDO::FETCH_ASSOC);return $r===false?null:$r;
    }
    private function json(array $r):string{return json_encode($r,JSON_THROW_ON_ERROR);}
    private function decode(string $s):array{return json_decode($s,true,512,JSON_THROW_ON_ERROR);}
    private function one(string $sql,array $a):void{
        if($this->q($sql,$a)->rowCount()!==1)throw new DomainException('unexpected affected rows');
    }
    public function atomic(callable $work):array{
        if($this->db->inTransaction())throw new DomainException('nested transaction');
        $required=['bpz_order_request','bpz_order_receipt','g5_member','g5_point',
                   'yc5_cart','yc5_order','yc5_item','yc5_category','yc5_item_option'];
        $rows=$this->q('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach($required as $t)if(strtoupper((string)($rows[$t]??''))!=='INNODB')
            throw new DomainException('nontransactional or missing table: '.$t);
        $this->db->beginTransaction();
        try{$r=$work();$this->db->commit();return $r;}
        catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }
    public function lockRequest(string $requestId):?array{
        $this->q('INSERT INTO bpz_order_request(request_id,receipt) VALUES (?,NULL) ON DUPLICATE KEY UPDATE request_id=request_id',[$requestId]);
        $r=$this->row('SELECT receipt FROM bpz_order_request WHERE request_id=? FOR UPDATE',[$requestId]);
        return $r['receipt']===null?null:$this->decode($r['receipt']);
    }
    public function lockMemberBalance(string $member):int{
        return $this->native->lockBalance($member);
    }
    public function lockCartLines(string $member,string $cart):array{
        $rows=$this->q('SELECT * FROM yc5_cart WHERE od_id=? ORDER BY it_id,ct_id FOR UPDATE',[$cart])->fetchAll(PDO::FETCH_ASSOC);
        $lines=[];
        foreach($rows as $r){
            if($r['mb_id']!==$member||$r['ct_status']!=='쇼핑'||$r['io_id']!==''||
               (int)$r['ct_point_use']!==0||(int)$r['ct_stock_use']!==0||(int)$r['ct_select']!==1)
                throw new DomainException('cart ownership/state conflict');
            $p=$this->row('SELECT i.*,c.ca_use FROM yc5_item i JOIN yc5_category c ON c.ca_id=i.ca_id WHERE i.it_id=? FOR UPDATE',[$r['it_id']]);
            if(!$p||(int)$p['it_use']!==1||(int)$p['ca_use']!==1||(int)$p['it_soldout']!==0||
               (int)$p['it_tel_inq']!==0||$p['it_option_subject']!==''||$p['it_supply_subject']!==''||
               (int)$p['it_sc_type']!==0||(int)$p['it_sc_price']!==0||
               (int)$this->q('SELECT COUNT(*) FROM yc5_item_option WHERE it_id=? AND io_use=1',[$r['it_id']])->fetchColumn()!==0)
                throw new DomainException('product unavailable or unsupported');
            $qty=(int)$r['ct_qty'];
            if(((int)$p['it_buy_min_qty']>0&&$qty<(int)$p['it_buy_min_qty'])||
               ((int)$p['it_buy_max_qty']>0&&$qty>(int)$p['it_buy_max_qty']))
                throw new DomainException('quantity limit');
            $lines[]=['item'=>$r['it_id'],'price'=>(int)$p['it_price'],'qty'=>$qty,'stock'=>(int)$p['it_stock_qty'],'ct_id'=>(int)$r['ct_id']];
        }
        return $lines;
    }
    public function writePurchase(string $member,string $cart,string $requestId,array $lines,int $total):array{
        $nativeDebit=$this->native->debit($member,$cart,$total);
        foreach($lines as $l){
            $this->one('UPDATE yc5_item SET it_stock_qty=it_stock_qty-? WHERE it_id=? AND it_stock_qty>=?',[$l['qty'],$l['item'],$l['qty']]);
            $this->one("UPDATE yc5_cart SET ct_status='입금',ct_price=?,ct_stock_use=1,ct_point=0,cp_price=0 WHERE ct_id=? AND od_id=? AND mb_id=? AND ct_status='쇼핑'",[$l['price'],$l['ct_id'],$cart,$member]);
        }
        $this->q("INSERT INTO yc5_order (od_id,mb_id,od_memo,od_cart_count,od_cart_price,od_receipt_point,od_shop_memo,od_mod_history,od_status,od_settle_case,od_cash,od_cash_no,od_cash_info,od_time,od_receipt_time) VALUES (?,?,'',?,?,?,'','','입금','포인트',0,'','',NOW(),NOW())",[$cart,$member,count($lines),$total,$total]);
        $receipt=['member'=>$member,'cart'=>$cart,'order'=>$cart,'debited_points'=>$total,'debit_id'=>$requestId,'state'=>'paid','fulfilled'=>false];
        $receipt['native_debit']=$nativeDebit;
        $json=$this->json($receipt);
        $this->q('INSERT INTO bpz_order_receipt(order_id,member_id,request_id,debit_points,receipt) VALUES (?,?,?,?,?)',[$cart,$member,$requestId,$total,$json]);
        $this->one('UPDATE bpz_order_request SET receipt=? WHERE request_id=? AND receipt IS NULL',[$json,$requestId]);
        return $receipt;
    }
    public function lockOrder(string $member,string $order):?array{
        $r=$this->row('SELECT * FROM bpz_order_receipt WHERE order_id=? AND member_id=? FOR UPDATE',[$order,$member]);
        if(!$r)return null;
        $n=$this->row('SELECT od_status,od_receipt_point FROM yc5_order WHERE od_id=? AND mb_id=? FOR UPDATE',[$order,$member]);
        if(!$n||(int)$n['od_receipt_point']!==(int)$r['debit_points'])throw new DomainException('native order mismatch');
        $result=$this->decode($r['receipt']);
        if($r['cancellation']!==null){
            if($n['od_status']!=='취소')throw new DomainException('native cancellation mismatch');
            $result['state']='cancelled';$result['cancellation_receipt']=$this->decode($r['cancellation']);
        }elseif($n['od_status']!=='입금'){$result['fulfilled']=true;}
        return $result;
    }
    public function writeCancellation(array $order):array{
        $id=$order['order'];$member=$order['member'];$total=$order['debited_points'];
        if(($order['native_debit']['amount']??null)!==$total)throw new DomainException('native debit receipt mismatch');
        $rows=$this->q('SELECT ct_id,it_id,ct_qty,ct_price,ct_status,ct_stock_use,mb_id FROM yc5_cart WHERE od_id=? ORDER BY it_id,ct_id FOR UPDATE',[$id])->fetchAll(PDO::FETCH_ASSOC);
        $sum=0;foreach($rows as $r){
            if($r['mb_id']!==$member||$r['ct_status']!=='입금'||(int)$r['ct_stock_use']!==1||(int)$r['ct_qty']<1||(int)$r['ct_price']<1)throw new DomainException('cancel cart mismatch');
            $sum+=(int)$r['ct_qty']*(int)$r['ct_price'];
        }
        if($sum!==$total)throw new DomainException('cancel amount mismatch');
        $this->native->reverse($member,$id,$order['native_debit']);
        foreach($rows as $r){
            $this->one('UPDATE yc5_item SET it_stock_qty=it_stock_qty+? WHERE it_id=? AND it_stock_qty<=?',[(int)$r['ct_qty'],$r['it_id'],2147483647-(int)$r['ct_qty']]);
            $this->one("UPDATE yc5_cart SET ct_status='취소',ct_stock_use=0 WHERE ct_id=? AND od_id=? AND mb_id=? AND ct_status='입금' AND ct_stock_use=1",[$r['ct_id'],$id,$member]);
        }
        $this->one("UPDATE yc5_order SET od_status='취소',od_cancel_price=? WHERE od_id=? AND mb_id=? AND od_status='입금'",[$total,$id,$member]);
        $receipt=['order'=>$id,'returned_points'=>$total,'state'=>'cancelled'];
        $this->one('UPDATE bpz_order_receipt SET cancellation=? WHERE order_id=? AND cancellation IS NULL',[$this->json($receipt),$id]);
        return $receipt;
    }
}

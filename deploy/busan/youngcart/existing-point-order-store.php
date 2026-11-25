<?php
declare(strict_types=1);
require_once __DIR__.'/existing-point-settlement.php';
require_once __DIR__.'/point-contract.php';
require_once __DIR__.'/checkout-readiness.php';
/** Shop-only persistence. Never writes g5_member/g5_point; pending orders
 * hold stock and retain evidence until the native point operation is known.
 * Isolated validation only until live concurrency and route QA are verified.
 */
final class BusanExistingPointOrderStore implements BusanPointOrderStore {
    public function __construct(private PDO $db){
        if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture'||$db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')
            BusanCheckoutReadiness::liveCheckout();
        $db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_EMULATE_PREPARES,false);
    }
    private function q(string $sql,array $a=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($a);return $s;}
    private function row(string $sql,array $a=[]):?array{$r=$this->q($sql,$a)->fetch(PDO::FETCH_ASSOC);return $r===false?null:$r;}
    private function one(string $sql,array $a):void{if($this->q($sql,$a)->rowCount()!==1)throw new RuntimeException('shop state conflict');}
    private function json(array $r):string{return json_encode($r,JSON_THROW_ON_ERROR);}
    private function decode(string $r):array{return json_decode($r,true,512,JSON_THROW_ON_ERROR);}
    private function tx(callable $fn):array{
        $this->db->beginTransaction();
        try{$r=$fn();$this->db->commit();return $r;}
        catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }
    public function serialized(string $member,callable $work):array{
        if($this->db->inTransaction())throw new RuntimeException('unexpected transaction');
        $engines=$this->q('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach(['yc5_cart','yc5_item','yc5_category','yc5_item_option','yc5_order','bpz_order_receipt','bpz_order_request'] as $table)
            if(strtoupper((string)($engines[$table]??''))!=='INNODB')throw new DomainException('shop schema unavailable');
        // This serializes shop actions only, not independent native point writers.
        $key='bpz:'.substr(hash('sha256',$member),0,48);
        if((int)$this->q('SELECT GET_LOCK(?,10)',[$key])->fetchColumn()!==1)throw new RuntimeException('shop busy');
        try{return $work();}finally{$this->q('SELECT RELEASE_LOCK(?)',[$key]);}
    }
    private function load(string $member,string $order):array{
        $r=$this->row('SELECT receipt FROM bpz_order_receipt WHERE order_id=? AND member_id=? FOR UPDATE',[$order,$member]);
        if(!$r)throw new DomainException('order unavailable');
        return $this->decode($r['receipt']);
    }
    private function save(array $o):void{
        $this->one('UPDATE bpz_order_receipt SET receipt=? WHERE order_id=? AND member_id=?',[$this->json($o),$o['order'],$o['member']]);
    }
    private function lockCartLines(string $member,string $cart):array{
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

    public function preparePurchase(string $member,string $cart,string $request,int $balance):array{
        return $this->tx(function()use($member,$cart,$request,$balance){
            $this->q('INSERT INTO bpz_order_request(request_id,receipt) VALUES (?,NULL) ON DUPLICATE KEY UPDATE request_id=request_id',[$request]);
            $req=$this->row('SELECT receipt FROM bpz_order_request WHERE request_id=? FOR UPDATE',[$request]);
            if($req['receipt']!==null){
                $r=$this->decode($req['receipt']);
                if($r['member']!==$member||$r['order']!==$cart)throw new DomainException('request binding conflict');
                return $this->load($member,$cart);
            }
            if($this->row('SELECT od_id FROM yc5_order WHERE od_id=? FOR UPDATE',[$cart]))throw new DomainException('order already exists');
            $lines=$this->lockCartLines($member,$cart);$seen=[];
            foreach($lines as $l){if(isset($seen[$l['item']]))throw new DomainException('duplicate item');$seen[$l['item']]=true;}
            $amount=BusanPointOnlyPolicy::quote($lines,$balance);
            if($amount>2147483647)throw new DomainException('amount limit');
            foreach($lines as $l){
                $this->one('UPDATE yc5_item SET it_stock_qty=it_stock_qty-? WHERE it_id=? AND it_stock_qty>=?',[$l['qty'],$l['item'],$l['qty']]);
                $this->one("UPDATE yc5_cart SET ct_status='주문',ct_price=?,ct_stock_use=1,ct_point=0,cp_price=0 WHERE ct_id=? AND od_id=? AND mb_id=? AND ct_status='쇼핑'",[$l['price'],$l['ct_id'],$cart,$member]);
            }
            $this->q("INSERT INTO yc5_order (od_id,mb_id,od_memo,od_cart_count,od_cart_price,od_receipt_point,od_shop_memo,od_mod_history,od_status,od_settle_case,od_cash,od_cash_no,od_cash_info,od_time) VALUES (?,?,'',?,?,0,'POINT ZONE pending','연동 확인 중','주문','포인트',0,'','',NOW())",[$cart,$member,count($lines),$amount]);
            $o=['member'=>$member,'order'=>$cart,'amount'=>$amount,'state'=>'debit_pending'];
            $this->q('INSERT INTO bpz_order_receipt(order_id,member_id,request_id,debit_points,receipt) VALUES (?,?,?,?,?)',[$cart,$member,$request,$amount,$this->json($o)]);
            $this->one('UPDATE bpz_order_request SET receipt=? WHERE request_id=? AND receipt IS NULL',[$this->json(['member'=>$member,'order'=>$cart]),$request]);
            $o['state']='new_debit_pending';return $o;
        });
    }
    public function finishPurchase(array $order,array $point):array{
        return $this->tx(function()use($order,$point){
            $o=$this->load($order['member'],$order['order']);
            if($o['state']!=='debit_pending'||$point['delta']!==-$o['amount']||$point['point_id']<1)throw new RuntimeException('pending debit conflict');
            $this->one("UPDATE yc5_order SET od_status='입금',od_receipt_point=?,od_receipt_time=NOW(),od_shop_memo='' WHERE od_id=? AND mb_id=? AND od_status='주문' AND od_receipt_point=0",[$o['amount'],$o['order'],$o['member']]);
            if($this->q("UPDATE yc5_cart SET ct_status='입금' WHERE od_id=? AND mb_id=? AND ct_status='주문' AND ct_stock_use=1",[$o['order'],$o['member']])->rowCount()<1)throw new RuntimeException('cart completion conflict');
            $o['state']='paid';$o['point_id']=$point['point_id'];$this->save($o);return $o;
        });
    }
    public function prepareRefund(string $member,string $order):array{
        return $this->tx(function()use($member,$order){
            $o=$this->load($member,$order);
            if($o['state']!=='paid')return $o;
            $r=$this->row('SELECT od_status,od_receipt_point FROM yc5_order WHERE od_id=? AND mb_id=? FOR UPDATE',[$order,$member]);
            if(!$r||$r['od_status']!=='입금'||(int)$r['od_receipt_point']!==$o['amount'])throw new DomainException('order cannot be cancelled');
            $o['state']='refund_pending';$this->save($o);$o['state']='new_refund_pending';return $o;
        });
    }
    public function finishRefund(array $order,array $point):array{
        return $this->tx(function()use($order,$point){
            $o=$this->load($order['member'],$order['order']);
            if($o['state']!=='refund_pending'||$point['delta']!==$o['amount']||$point['point_id']<1)throw new RuntimeException('pending refund conflict');
            $rows=$this->q('SELECT ct_id,it_id,ct_qty,ct_price,ct_status,ct_stock_use,mb_id FROM yc5_cart WHERE od_id=? ORDER BY it_id,ct_id FOR UPDATE',[$o['order']])->fetchAll(PDO::FETCH_ASSOC);
            $total=0;foreach($rows as $r){
                if($r['mb_id']!==$o['member']||$r['ct_status']!=='입금'||(int)$r['ct_stock_use']!==1||(int)$r['ct_qty']<1||(int)$r['ct_price']<1)throw new RuntimeException('cart refund conflict');
                $total+=(int)$r['ct_qty']*(int)$r['ct_price'];
            }
            if($total!==$o['amount'])throw new RuntimeException('refund amount mismatch');
            foreach($rows as $r){
                $this->one('UPDATE yc5_item SET it_stock_qty=it_stock_qty+? WHERE it_id=? AND it_stock_qty<=?',[(int)$r['ct_qty'],$r['it_id'],2147483647-(int)$r['ct_qty']]);
                $this->one("UPDATE yc5_cart SET ct_status='취소',ct_stock_use=0 WHERE ct_id=? AND od_id=? AND mb_id=? AND ct_status='입금'",[$r['ct_id'],$o['order'],$o['member']]);
            }
            $this->one("UPDATE yc5_order SET od_status='취소',od_cancel_price=? WHERE od_id=? AND mb_id=? AND od_status='입금'",[$o['amount'],$o['order'],$o['member']]);
            $o['state']='cancelled';$o['refund_point_id']=$point['point_id'];$this->save($o);return $o;
        });
    }
}

<?php
declare(strict_types=1);
/* Native Youngcart cart adapter. Not exposed via a live HTTP route yet.
 * PDO must use the same DB connection for the entire operation.
 * Caller supplies authenticated member and server session cart ID only.
 * Unsupported options, shipment rules and coupons fail closed.
 */
require_once __DIR__.'/point-contract.php';
final class BusanNativeCart {
    private PDO $db;
    public function __construct(PDO $db){$this->db=$db;}
    private function query(string $sql,array $args=[]):PDOStatement{
        $s=$this->db->prepare($sql);$s->execute($args);return $s;
    }
    private static function owner(string $member,string $cart):void{
        if($member===''||strlen($member)>255||!preg_match('/^[1-9][0-9]{14}$/D',$cart))throw new DomainException('invalid authenticated cart');
    }
    private function scope(string $member,string $cart):array{
        self::owner($member,$cart);
        $rows=$this->query("SELECT ct_id,mb_id,it_id,ct_qty,ct_status,io_id,ct_stock_use,ct_point_use FROM yc5_cart WHERE od_id=? ORDER BY ct_id FOR UPDATE",[$cart])->fetchAll(PDO::FETCH_ASSOC);
        foreach($rows as $row){
            if($row['mb_id']!==$member||$row['ct_status']!=='쇼핑'||$row['io_id']!==''||(int)$row['ct_stock_use']!==0||(int)$row['ct_point_use']!==0)
                throw new DomainException('cart ownership or state conflict');
        }
        return $rows;
    }
    private function product(string $id):array{
        if(!preg_match('/^[a-f0-9]{20}$/D',$id))throw new DomainException('invalid product');
        $r=$this->query("SELECT i.it_id,i.it_name,i.it_price,i.it_stock_qty,i.it_use,i.it_soldout,i.it_sc_type,i.it_sc_price,i.it_option_subject,i.it_supply_subject,i.it_buy_min_qty,i.it_buy_max_qty,i.it_tel_inq,c.ca_use FROM yc5_item i JOIN yc5_category c ON c.ca_id=i.ca_id WHERE i.it_id=? FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
        if(!$r||(int)$r['it_use']!==1||(int)$r['ca_use']!==1||(int)$r['it_soldout']!==0||(int)$r['it_tel_inq']!==0)
            throw new DomainException('product unavailable');
        if($r['it_option_subject']!==''||$r['it_supply_subject']!==''||
           (int)$r['it_sc_type']!==0||(int)$r['it_sc_price']!==0)
            throw new DomainException('option or shipping policy not integrated');
        $option=$this->query("SELECT COUNT(*) FROM yc5_item_option WHERE it_id=? AND io_use=1",[$id])->fetchColumn();
        if((int)$option!==0)throw new DomainException('option policy not integrated');
        if((int)$r['it_price']<1)throw new DomainException('invalid product price');
        return $r;
    }
    private static function quantity(array $r,int $qty):void{
        if($qty<1||$qty>(int)$r['it_stock_qty']||
           ((int)$r['it_buy_min_qty']>0&&$qty<(int)$r['it_buy_min_qty'])||
           ((int)$r['it_buy_max_qty']>0&&$qty>(int)$r['it_buy_max_qty']))
            throw new DomainException('quantity or stock limit');
    }
    private function atomic(string $member,string $cart,callable $fn){
        self::owner($member,$cart);
        // Serialize same-cart operations even before its first row exists.
        $key='bpz-cart-'.hash('sha1',$cart);
        if((int)$this->query('SELECT GET_LOCK(?,5)',[$key])->fetchColumn()!==1)throw new RuntimeException('cart busy');
        try{
            $this->db->beginTransaction();
            $value=$fn($this->scope($member,$cart));
            $this->db->commit();return $value;
        }catch(Throwable $e){
            if($this->db->inTransaction())$this->db->rollBack();
            throw $e;
        }finally{$this->query('SELECT RELEASE_LOCK(?)',[$key]);}
    }
    public function set(string $member,string $cart,string $item,int $qty):void{
        $this->atomic($member,$cart,function(array $rows)use($member,$cart,$item,$qty){
            $r=$this->product($item);self::quantity($r,$qty);
            $match=array_values(array_filter($rows,static fn($x)=>$x['it_id']===$item));
            if(count($match)>1)throw new DomainException('duplicate native cart rows');
            if($match){
                $this->query("UPDATE yc5_cart SET ct_qty=?,ct_price=?,it_name=?,ct_point=0,cp_price=0,ct_select=1,ct_select_time=NOW() WHERE ct_id=? AND mb_id=? AND ct_status='쇼핑'",[$qty,(int)$r['it_price'],$r['it_name'],$match[0]['ct_id'],$member]);
            }else{
                $this->query("INSERT INTO yc5_cart (od_id,mb_id,it_id,it_name,ct_status,ct_history,ct_price,ct_qty,ct_point,ct_option,ct_time,ct_select,ct_select_time) VALUES (?,?,?,?,'쇼핑','',?,?,0,?,NOW(),1,NOW())",[$cart,$member,$item,$r['it_name'],(int)$r['it_price'],$qty,$r['it_name']]);
            }
        });
    }
    public function remove(string $member,string $cart,string $item):void{
        if(!preg_match('/^[a-f0-9]{20}$/D',$item))throw new DomainException('invalid product');
        $this->atomic($member,$cart,function(array $rows)use($member,$cart,$item){
            $this->query("DELETE FROM yc5_cart WHERE od_id=? AND mb_id=? AND it_id=? AND ct_status='쇼핑'",[$cart,$member,$item]);
        });
    }
    // Quote is advisory only. The checkout transaction must reprice, reserve
    // stock and debit the shared ledger atomically; no live checkout here.
    public function quote(string $member,string $cart,int $verifiedBalance):array{
        return $this->atomic($member,$cart,function(array $rows)use($verifiedBalance){
            $lines=[];$seen=[];
            foreach($rows as $row){
                $id=$row['it_id'];if(isset($seen[$id]))throw new DomainException('duplicate cart rows');$seen[$id]=true;
                $r=$this->product($id);$qty=(int)$row['ct_qty'];self::quantity($r,$qty);
                $lines[]=['item'=>$id,'price'=>(int)$r['it_price'],'qty'=>$qty,'stock'=>(int)$r['it_stock_qty']];
            }
            $total=BusanPointOnlyPolicy::quote($lines,$verifiedBalance);
            if($total>2147483647)throw new DomainException('native order amount exceeds supported range');
            return ['lines'=>$lines,'total_points'=>$total,'remaining_points'=>$verifiedBalance-$total,'method'=>'POINT','order_created'=>false];
        });
    }
}

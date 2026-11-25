<?php
declare(strict_types=1);
/**
 * Youngcart-side adapter for the existing GnuBoard point API.
 * Does not create a point table, change a storage engine, or write balances directly.
 * Caller must serialize Youngcart actions and retain durable order evidence.
 * Native MyISAM calls are not transactional: ambiguous outcomes must be held
 * for reconciliation, never blindly repeated or automatically compensated.
 */
final class BusanExistingPoints {
    public const REL='@bpz-order';
    public function __construct(private Closure $balance,private Closure $find,private Closure $insert){}
    public static function native():self{
        if(!defined('_GNUBOARD_')||empty($GLOBALS['config']['cf_use_point'])||
           !function_exists('insert_point')||!function_exists('sql_query')||
           !function_exists('sql_real_escape_string'))throw new DomainException('existing point system unavailable');
        $memberTable=$GLOBALS['g5']['member_table']??'';
        $pointTable=$GLOBALS['g5']['point_table']??'';
        if($memberTable!=='g5_member'||$pointTable!=='g5_point')throw new DomainException('unexpected native point tables');
        $q=static fn(string $v):string=>"'".sql_real_escape_string($v)."'";
        return new self(
            static function(string $member)use($q):int{
                $r=sql_fetch('SELECT mb_point,mb_leave_date,mb_intercept_date FROM g5_member WHERE mb_id='.$q($member),false);
                if(!isset($r['mb_point'])||!empty($r['mb_leave_date'])||!empty($r['mb_intercept_date']))throw new DomainException('member unavailable');
                $sum=sql_fetch('SELECT COALESCE(SUM(po_point),0) AS total FROM g5_point WHERE mb_id='.$q($member),false);
                if(!isset($sum['total'])||(int)$sum['total']!==(int)$r['mb_point'])throw new RuntimeException('native balance requires reconciliation');
                if((int)($GLOBALS['config']['cf_point_term']??0)>0){
                    $due=sql_fetch('SELECT COUNT(*) AS n FROM g5_point WHERE mb_id='.$q($member)." AND po_expired=0 AND po_point>po_use_point AND po_expire_date<".$q(G5_TIME_YMD),false);
                    if(!isset($due['n'])||(int)$due['n']!==0)throw new DomainException('existing point expiry must be processed first');
                }
                // Read-only check catches an interrupted native allocation update.
                $lots=sql_fetch('SELECT COALESCE(SUM(CASE WHEN po_point>0 AND po_expired=0 THEN po_point-po_use_point ELSE 0 END),0) AS available, COALESCE(SUM(CASE WHEN po_point>0 AND (po_use_point<0 OR po_use_point>po_point OR (po_expired=100 AND po_use_point<>po_point)) THEN 1 ELSE 0 END),0) AS invalid FROM g5_point WHERE mb_id='.$q($member),false);
                if(!isset($lots['available'],$lots['invalid'])||(int)$lots['invalid']!==0||(int)$lots['available']!==(int)$r['mb_point'])throw new RuntimeException('native allocation requires reconciliation');
                return (int)$r['mb_point'];
            },
            static function(string $member,string $order,string $action)use($q):array{
                $rs=sql_query('SELECT po_id,po_point FROM g5_point WHERE mb_id='.$q($member).' AND po_rel_table='.$q(self::REL).' AND po_rel_id='.$q($order).' AND po_rel_action='.$q($action).' LIMIT 2',false);
                if($rs===false)throw new RuntimeException('point evidence query failed');
                $rows=[];while($r=sql_fetch_array($rs))$rows[]=['id'=>(int)$r['po_id'],'delta'=>(int)$r['po_point']];
                return $rows;
            },
            static function(string $member,string $order,string $action,int $delta):int{
                // Native insert_point interpolates member IDs; reject unsafe IDs.
                if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member))throw new DomainException('unsupported native member id');
                return (int)insert_point($member,$delta,$delta<0?'POINT ZONE 상품 구매':'POINT ZONE 주문 취소',self::REL,$order,$action);
            }
        );
    }
    private static function validate(string $member,string $order,int $amount):void{
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member)||!preg_match('/^[1-9][0-9]{14}$/D',$order)||$amount<1||$amount>2147483647)
            throw new DomainException('invalid point transaction');
    }
    public function balance(string $member):int{
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$member))throw new DomainException('unsupported native member id');
        return ($this->balance)($member);
    }
    public function evidence(string $member,string $order,string $action,int $delta):?array{
        if(!in_array($action,['purchase','refund'],true))throw new DomainException('invalid action');
        self::validate($member,$order,abs($delta));
        $rows=($this->find)($member,$order,$action);
        if(!$rows)return null;
        if(count($rows)!==1||$rows[0]['delta']!==$delta||$rows[0]['id']<1)throw new RuntimeException('point evidence conflict: hold order');
        return $rows[0];
    }
    private function apply(string $member,string $order,string $action,int $delta):array{
        self::validate($member,$order,abs($delta));
        $prior=$this->evidence($member,$order,$action,$delta);
        if($prior!==null)throw new RuntimeException('existing point entry: reconcile pending order; do not repeat');
        $before=$this->balance($member);
        if($before<0||($delta<0&&$before<-$delta)||($delta>0&&$before>2147483647-$delta))
            throw new DomainException('insufficient points or balance limit');
        // If insert throws or its receipt is uncertain, the caller must keep
        // its durable pending marker. No retry, no automatic extra credit.
        $result=($this->insert)($member,$order,$action,$delta);
        $entry=$this->evidence($member,$order,$action,$delta);
        $after=$this->balance($member);
        if($result!==1||$entry===null||$after!==$before+$delta)
            throw new RuntimeException('point operation uncertain: hold order');
        return ['point_id'=>$entry['id'],'delta'=>$delta,'balance_after'=>$after];
    }
    public function debit(string $member,string $order,int $amount):array{
        self::validate($member,$order,$amount);
        if($this->evidence($member,$order,'refund',$amount)!==null)throw new DomainException('order already refunded');
        return $this->apply($member,$order,'purchase',-$amount);
    }
    public function refund(string $member,string $order,int $amount,int $originalPointId):array{
        self::validate($member,$order,$amount);
        $debit=$this->evidence($member,$order,'purchase',-$amount);
        if($debit===null||$debit['id']!==$originalPointId)throw new DomainException('original debit unavailable');
        // Native positive credit follows the existing site's expiry policy.
        return $this->apply($member,$order,'refund',$amount);
    }
}

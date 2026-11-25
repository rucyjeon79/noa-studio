<?php
declare(strict_types=1);

/**
 * Native GnuBoard single-ledger transaction component.
 * Caller MUST hold the same PDO transaction as the order/stock writes.
 * No separate point balance. No automatic migration or live route.
 * Production release additionally requires every existing point writer
 * to share the member lock and transaction protocol.
 */
final class BusanNativePointLedger {
    public function __construct(private PDO $db){}
    private function q(string $sql,array $args=[]):PDOStatement{
        $s=$this->db->prepare($sql);$s->execute($args);return $s;
    }
    private function guard():void{
        if(!$this->db->inTransaction())throw new DomainException('native ledger requires transaction');
        $engines=$this->q("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('g5_member','g5_point')")->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach(['g5_member','g5_point'] as $t)
            if(strtoupper((string)($engines[$t]??''))!=='INNODB')throw new DomainException('native ledger not transactional');
    }
    private function now():DateTimeImmutable{return new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul'));}
    private function state(string $member):array{
        $this->guard();
        $m=$this->q('SELECT mb_point,mb_leave_date,mb_intercept_date FROM g5_member WHERE mb_id=? FOR UPDATE',[$member])->fetch(PDO::FETCH_ASSOC);
        if(!$m||$m['mb_leave_date']!==''||$m['mb_intercept_date']!=='')throw new DomainException('member unavailable');
        $rows=$this->q('SELECT po_id,po_point,po_use_point,po_expired,po_expire_date,po_rel_table,po_rel_id,po_rel_action FROM g5_point WHERE mb_id=? ORDER BY po_expire_date,po_id FOR UPDATE',[$member])->fetchAll(PDO::FETCH_ASSOC);
        $today=$this->now()->format('Y-m-d');$sum=0;$available=0;$lots=[];
        foreach($rows as $r){
            $p=(int)$r['po_point'];$u=(int)$r['po_use_point'];$flag=(int)$r['po_expired'];$sum+=$p;
            if($p<=0)continue;
            if($u<0||$u>$p||!in_array($flag,[0,1,100],true))throw new DomainException('invalid native point allocation');
            if($p===$u)continue;
            // The native expiry routine may modify the ledger. Never silently
            // reconcile it in a checkout; require the existing process first.
            if($flag!==0||$r['po_expire_date']<$today)throw new DomainException('unreconciled point expiry');
            $available+=$p-$u;$lots[]=$r;
        }
        if($sum<0||$sum>2147483647||$sum!==(int)$m['mb_point']||$available!==$sum)
            throw new DomainException('native member/ledger balance mismatch');
        return ['balance'=>$sum,'lots'=>$lots,'rows'=>$rows,'today'=>$today];
    }
    public function lockBalance(string $member):int{return $this->state($member)['balance'];}
    private function eventExists(array $state,string $order,string $action):bool{
        foreach($state['rows'] as $r)if($r['po_rel_table']==='@bpz-order'&&$r['po_rel_id']===$order&&$r['po_rel_action']===$action)return true;
        return false;
    }
    private function append(string $member,string $order,string $action,int $delta,int $balance,string $expiry,int $flag):int{
        $this->q("INSERT INTO g5_point (mb_id,po_datetime,po_content,po_point,po_use_point,po_expired,po_expire_date,po_mb_point,po_rel_table,po_rel_id,po_rel_action) VALUES (?,?,?,?,0,?,?,?,'@bpz-order',?,?)",
            [$member,$this->now()->format('Y-m-d H:i:s'),$delta<0?'POINT ZONE 주문':'POINT ZONE 주문 취소',$delta,$flag,$expiry,$balance,$order,$action]);
        return (int)$this->db->lastInsertId();
    }
    private function updateBalance(string $member,int $before,int $after):void{
        if($after<0||$after>2147483647||$this->q('UPDATE g5_member SET mb_point=? WHERE mb_id=? AND mb_point=?',[$after,$member,$before])->rowCount()!==1)
            throw new DomainException('native balance update conflict');
    }
    public function debit(string $member,string $order,int $amount):array{
        if($amount<1)throw new DomainException('invalid debit');
        $s=$this->state($member);
        if($amount>$s['balance']||$this->eventExists($s,$order,'purchase'))throw new DomainException('insufficient points or duplicate debit');
        $left=$amount;$alloc=[];
        foreach($s['lots'] as $r){
            if($left===0)break;
            $take=min($left,(int)$r['po_point']-(int)$r['po_use_point']);
            $new=(int)$r['po_use_point']+$take;$flag=$new===(int)$r['po_point']?100:0;
            if($this->q('UPDATE g5_point SET po_use_point=?,po_expired=? WHERE po_id=? AND mb_id=? AND po_use_point=? AND po_expired=0',[$new,$flag,$r['po_id'],$member,$r['po_use_point']])->rowCount()!==1)
                throw new DomainException('point allocation conflict');
            $alloc[]=['po_id'=>(int)$r['po_id'],'amount'=>$take,'expiry'=>$r['po_expire_date']];
            $left-=$take;
        }
        if($left!==0)throw new DomainException('unallocated debit');
        $after=$s['balance']-$amount;
        $id=$this->append($member,$order,'purchase',-$amount,$after,$s['today'],1);
        $this->updateBalance($member,$s['balance'],$after);
        return ['id'=>$id,'allocations'=>$alloc,'amount'=>$amount];
    }
    public function reverse(string $member,string $order,array $debit):void{
        $s=$this->state($member);$amount=$debit['amount']??0;$id=$debit['id']??0;
        if(!is_int($amount)||$amount<1||!is_int($id)||$id<1||!is_array($debit['allocations']??null)||$s['balance']>2147483647-$amount)
            throw new DomainException('invalid reversal receipt');
        $byId=[];foreach($s['rows'] as $r)$byId[(int)$r['po_id']]=$r;
        $original=$byId[$id]??null;
        if(!$original||$original['po_rel_table']!=='@bpz-order'||$original['po_rel_id']!==$order||$original['po_rel_action']!=='purchase'||(int)$original['po_point']!==-$amount)
            throw new DomainException('original native debit unavailable');
        $total=0;$seen=[];
        foreach($debit['allocations'] as $i=>$a){
            $source=$byId[$a['po_id']??0]??null;$n=$a['amount']??0;$expiry=$a['expiry']??'';
            if(!$source||isset($seen[$a['po_id']])||!is_int($n)||$n<1||(int)$source['po_use_point']<$n||$source['po_expire_date']!==$expiry||$expiry<$s['today']||$this->eventExists($s,$order,'refund-'.$i))
                throw new DomainException('reversal allocation unavailable or expired');
            $seen[$a['po_id']]=true;$total+=$n;
        }
        if($total!==$amount)throw new DomainException('reversal total mismatch');
        // Append positive credits with original expiry; do not also decrease
        // old lot usage (that would make refunded points spendable twice).
        $balance=$s['balance'];
        foreach($debit['allocations'] as $i=>$a){
            $balance+=$a['amount'];
            $this->append($member,$order,'refund-'.$i,$a['amount'],$balance,$a['expiry'],0);
        }
        $this->updateBalance($member,$s['balance'],$balance);
    }
}

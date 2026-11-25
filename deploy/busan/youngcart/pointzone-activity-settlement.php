<?php
declare(strict_types=1);
require_once __DIR__.'/existing-points.php';
/** Candidate policy: highest bid paid at close, fixed campaign contribution,
 * administrator-selected event recipient. No production point changes until
 * policy and independent native writer concurrency are verified. */
final class BusanActivitySettlement {
    public function __construct(private PDO $db){
        if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture'||$db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')
            throw new DomainException('activity settlement not released');
    }
    private function q(string $sql,array $p=[]):PDOStatement{$s=$this->db->prepare($sql);$s->execute($p);return $s;}
    private function row(string $sql,array $p=[]):array{$r=$this->q($sql,$p)->fetch(PDO::FETCH_ASSOC);if(!$r)throw new DomainException('record unavailable');return $r;}
    private function actor(bool $admin=false):string{
        $m=$GLOBALS['member']??[];$id=$m['mb_id']??'';
        if(empty($GLOBALS['is_member'])||!empty($m['mb_leave_date'])||!empty($m['mb_intercept_date'])||!is_string($id)||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id)||($admin&&($GLOBALS['is_admin']??'')!=='super'))throw new DomainException('permission denied');
        return $id;
    }
    private function id(string $s):string{if(!preg_match('/^[a-f0-9]{32}$/D',$s))throw new DomainException('invalid id');return $s;}
    private function tx(callable $f):array{$this->db->beginTransaction();try{$r=$f();$this->db->commit();return $r;}catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}}
    private function serial(string $member,callable $f):array{
        $key='bpz:'.substr(hash('sha256',$member),0,48);
        if((int)$this->q('SELECT GET_LOCK(?,10)',[$key])->fetchColumn()!==1)throw new RuntimeException('busy');
        try{return $f();}finally{$this->q('SELECT RELEASE_LOCK(?)',[$key]);}
    }
    private function activity(string $id):array{return $this->row('SELECT * FROM bpz_activity WHERE id=? FOR UPDATE',[$this->id($id)]);}
    private function open(array $a,string $kind):void{
        $now=date('Y-m-d H:i:s');
        if($a['kind']!==$kind||$a['state']!=='open'||$a['opens_at']>$now||($a['closes_at']!==null&&$a['closes_at']<=$now))throw new DomainException('activity unavailable');
    }
    private function existing(string $member,string $request,string $id,int $amount):?array{
        $r=$this->q('SELECT * FROM bpz_participation WHERE mb_id=? AND request_id=?',[$member,$this->id($request)])->fetch(PDO::FETCH_ASSOC);
        if(!$r)return null;
        if($r['activity_id']!==$id||(int)$r['amount']!==$amount)throw new DomainException('request conflict');
        return $r;
    }
    private function create(string $id,string $member,string $request,int $amount,string $state):array{
        $pid=bin2hex(random_bytes(16));
        $this->q('INSERT INTO bpz_participation(id,activity_id,mb_id,request_id,amount,state,created_at) VALUES(?,?,?,?,?,?,NOW())',[$pid,$id,$member,$request,$amount,$state]);
        return $this->row('SELECT * FROM bpz_participation WHERE id=?',[$pid]);
    }
    public function publish(string $id):array{
        $this->actor(true);
        return $this->tx(function()use($id){
            $a=$this->activity($id);
            if($a['state']!=='draft'||($a['closes_at']!==null&&$a['closes_at']<=date('Y-m-d H:i:s'))||!in_array($a['kind'],['auction','sharing','events','profile'],true))throw new DomainException('cannot publish');
            if($a['kind']==='profile'&&(int)$this->q('SELECT COUNT(*) FROM yc5_item WHERE it_id=? AND it_use=1',[$a['item_id']])->fetchColumn()!==1)throw new DomainException('published product required');
            $this->q("UPDATE bpz_activity SET state='open' WHERE id=?",[$id]);return $this->activity($id);
        });
    }
    public function close(string $id):array{
        $this->actor(true);
        return $this->tx(function()use($id){
            $a=$this->activity($id);
            if($a['state']!=='open'||$a['kind']==='auction')throw new DomainException('invalid close');
            if((int)$this->q("SELECT COUNT(*) FROM bpz_participation WHERE activity_id=? AND state='pending'",[$id])->fetchColumn()>0)throw new RuntimeException('settlement pending');
            $this->q("UPDATE bpz_activity SET state='closed' WHERE id=?",[$id]);return $this->activity($id);
        });
    }
    public function bid(string $id,string $request,int $amount):array{
        $m=$this->actor();
        return $this->serial($m,function()use($id,$request,$amount,$m){
            return $this->tx(function()use($id,$request,$amount,$m){
                $a=$this->activity($id);$old=$this->existing($m,$request,$id,$amount);if($old)return $old;
                $this->open($a,'auction');
                $top=$this->q("SELECT MAX(amount) FROM bpz_participation WHERE activity_id=? AND state='submitted'",[$id])->fetchColumn();
                $min=$top===null?(int)$a['point_amount']:(int)$top+(int)$a['step_points'];
                if($amount<$min||$amount>2147483647||$amount>BusanExistingPoints::native()->balance($m))throw new DomainException('bid amount unavailable');
                return $this->create($id,$m,$request,$amount,'submitted');
            });
        });
    }
    private function nativeEvidence(array $p,int $delta):?array{
        $rows=$this->q("SELECT po_id,po_point FROM g5_point WHERE mb_id=? AND po_rel_table='@bpz-activity' AND po_rel_id=? AND po_rel_action=? LIMIT 2",[$p['mb_id'],substr($p['id'],0,20),'settle:'.$p['id']])->fetchAll(PDO::FETCH_ASSOC);
        if(!$rows)return null;
        if(count($rows)!==1||(int)$rows[0]['po_point']!==$delta||(int)$rows[0]['po_id']<1)throw new RuntimeException('point evidence conflict');
        return $rows[0];
    }
    private function finish(array $p,int $delta,int $pointId):array{
        return $this->tx(function()use($p,$delta,$pointId){
            $a=$this->activity($p['activity_id']);
            $r=$this->row('SELECT * FROM bpz_participation WHERE id=? FOR UPDATE',[$p['id']]);
            if($r['state']!=='pending'||$r['mb_id']!==$p['mb_id']||(int)$r['amount']!==abs($delta))throw new RuntimeException('pending state conflict');
            $state=$a['kind']==='sharing'?'confirmed':'awarded';
            $this->q('UPDATE bpz_participation SET state=?,native_point_id=? WHERE id=?',[$state,$pointId,$p['id']]);
            if($a['kind']==='auction'){
                $this->q("UPDATE bpz_participation SET state='rejected' WHERE activity_id=? AND state='submitted'",[$a['id']]);
                $this->q("UPDATE bpz_activity SET state='closed' WHERE id=?",[$a['id']]);
            }
            return $this->row('SELECT * FROM bpz_participation WHERE id=?',[$p['id']]);
        });
    }
    private function settle(array $p,int $delta):array{
        if($this->nativeEvidence($p,$delta)!==null)throw new RuntimeException('existing evidence; reconcile only');
        $points=BusanExistingPoints::native();$before=$points->balance($p['mb_id']);
        if($before+$delta<0||$before+$delta>2147483647)throw new DomainException('balance limit; pending review');
        $result=insert_point($p['mb_id'],$delta,'POINT ZONE 활동 정산','@bpz-activity',substr($p['id'],0,20),'settle:'.$p['id']);
        $e=$this->nativeEvidence($p,$delta);
        if($result!==1||!$e||$points->balance($p['mb_id'])!==$before+$delta)throw new RuntimeException('uncertain settlement; no retry');
        return $this->finish($p,$delta,(int)$e['po_id']);
    }
    public function contribute(string $id,string $request):array{
        $m=$this->actor();
        return $this->serial($m,function()use($id,$request,$m){
            $p=$this->tx(function()use($id,$request,$m){
                $a=$this->activity($id);$amount=(int)$a['point_amount'];$old=$this->existing($m,$request,$id,$amount);
                if($old)return $old+['fresh'=>false];
                $this->open($a,'sharing');
                if($amount<1||BusanExistingPoints::native()->balance($m)<$amount)throw new DomainException('insufficient points');
                $n=(int)$this->q("SELECT COUNT(*) FROM bpz_participation WHERE activity_id=? AND state IN ('pending','confirmed')",[$id])->fetchColumn();
                if((int)$a['capacity']>0&&$n>=(int)$a['capacity'])throw new DomainException('campaign full');
                return $this->create($id,$m,$request,$amount,'pending')+['fresh'=>true];
            });
            if(!$p['fresh']){if($p['state']==='confirmed')return $p;throw new RuntimeException('pending contribution');}
            return $this->settle($p,-(int)$p['amount']);
        });
    }
    public function closeAuction(string $id):array{
        $this->actor(true);
        $p=$this->tx(function()use($id){
            $a=$this->activity($id);
            if($a['kind']!=='auction'||$a['state']!=='open'||$a['closes_at']===null||$a['closes_at']>date('Y-m-d H:i:s'))throw new DomainException('auction not ended');
            if((int)$this->q("SELECT COUNT(*) FROM bpz_participation WHERE activity_id=? AND state='pending'",[$id])->fetchColumn()>0)throw new RuntimeException('settlement pending');
            $p=$this->q("SELECT * FROM bpz_participation WHERE activity_id=? AND state='submitted' ORDER BY amount DESC,created_at,id LIMIT 1 FOR UPDATE",[$id])->fetch(PDO::FETCH_ASSOC);
            if(!$p){$this->q("UPDATE bpz_activity SET state='closed' WHERE id=?",[$id]);return ['state'=>'closed'];}
            $this->q("UPDATE bpz_participation SET state='pending' WHERE id=?",[$p['id']]);$p['state']='pending';return $p;
        });
        if($p['state']==='closed')return $p;
        return $this->serial($p['mb_id'],fn()=>$this->settle($p,-(int)$p['amount']));
    }
    public function awardEvent(string $id,string $participant):array{
        $this->actor(true);
        $p=$this->tx(function()use($id,$participant){
            $a=$this->activity($id);
            if($a['kind']!=='events'||!in_array($a['state'],['open','closed'],true)||(int)$a['point_amount']<1)throw new DomainException('reward unavailable');
            $p=$this->row('SELECT * FROM bpz_participation WHERE id=? AND activity_id=? FOR UPDATE',[$this->id($participant),$id]);
            if($p['state']==='awarded')return $p;
            if($p['state']!=='confirmed'||(int)$p['amount']!==0)throw new DomainException('participant unavailable');
            $p['amount']=(int)$a['point_amount'];$p['state']='pending';
            $this->q("UPDATE bpz_participation SET amount=?,state='pending' WHERE id=?",[$p['amount'],$p['id']]);return $p;
        });
        if($p['state']==='awarded')return $p;
        return $this->serial($p['mb_id'],fn()=>$this->settle($p,(int)$p['amount']));
    }
    public function recover(string $participant,int $pointId):array{
        $this->actor(true);
        $p=$this->row('SELECT p.*,a.kind FROM bpz_participation p JOIN bpz_activity a ON a.id=p.activity_id WHERE p.id=?',[$this->id($participant)]);
        if($p['state']!=='pending')throw new DomainException('not pending');
        $delta=(int)$p['amount']*($p['kind']==='events'?1:-1);
        return $this->serial($p['mb_id'],function()use($p,$delta,$pointId){
            $e=$this->nativeEvidence($p,$delta);BusanExistingPoints::native()->balance($p['mb_id']);
            if(!$e||(int)$e['po_id']!==$pointId)throw new DomainException('verified receipt required');
            return $this->finish($p,$delta,$pointId);
        });
    }
}

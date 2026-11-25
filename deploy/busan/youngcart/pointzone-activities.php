<?php
declare(strict_types=1);
/** Feature-side records only. Existing points are NOT stored here as balances.
 * Draft configuration and non-financial participation are separate from
 * point settlement. Financial actions remain closed until the existing native
 * point API has a verified safe integration. No automatic awards or debits.
 */
final class BusanPointZoneActivities {
    public function __construct(private PDO $db){}
    private function q(string $sql,array $args=[]):PDOStatement{
        $s=$this->db->prepare($sql);$s->execute($args);return $s;
    }
    private static function id(string $id):string{
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new DomainException('invalid activity or request');
        return $id;
    }
    private static function member(string $id):string{
        if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$id))throw new DomainException('invalid member');
        return $id;
    }
    private static function admin():void{
        if(empty($GLOBALS['is_member'])||($GLOBALS['is_admin']??'')!=='super')throw new DomainException('admin only');
    }
    private function actor():string{
        $m=$GLOBALS['member']??[];
        if(empty($GLOBALS['is_member'])||!empty($m['mb_leave_date'])||!empty($m['mb_intercept_date']))throw new DomainException('active member only');
        return self::member((string)($m['mb_id']??''));
    }
    private static function kind(string $kind):string{
        if(!in_array($kind,['auction','sharing','events','profile'],true))throw new DomainException('invalid kind');
        return $kind;
    }
    private static function date(string $v):string{
        $d=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$v);
        if(!$d||$d->format('Y-m-d H:i:s')!==$v)throw new DomainException('invalid schedule');
        return $v;
    }
    private function atomic(callable $f):array{
        $this->db->beginTransaction();
        try{$result=$f();$this->db->commit();return $result;}
        catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
    }
    private function activity(string $id,bool $lock=false):array{
        $r=$this->q('SELECT * FROM bpz_activity WHERE id=?'.($lock?' FOR UPDATE':''),[self::id($id)])->fetch(PDO::FETCH_ASSOC);
        if(!$r)throw new DomainException('activity not found');
        return $r;
    }
    private static function config(array $p):array{
        $kind=self::kind((string)($p['kind']??''));
        $title=trim((string)($p['title']??''));$description=trim((string)($p['description']??''));
        if($title===''||mb_strlen($title)>100||mb_strlen($description)>4000)throw new DomainException('invalid text');
        $open=self::date((string)($p['opens_at']??''));$close=$p['closes_at']??null;
        if($close!==null){$close=self::date($close);if($close<=$open)throw new DomainException('invalid schedule');}
        $nums=[];
        foreach(['point_amount','step_points','capacity','duration_days'] as $k){
            $n=$p[$k]??0;if(!is_int($n)||$n<0||$n>2147483647)throw new DomainException('invalid numeric policy');
            $nums[$k]=$n;
        }
        if($kind==='auction'&&($nums['point_amount']<1||$nums['step_points']<1||$close===null))throw new DomainException('auction start, increment and deadline required');
        if($kind==='sharing'&&$nums['point_amount']<1)throw new DomainException('sharing amount required');
        $item=$p['item_id']??null;
        if($kind==='profile'&&(!is_string($item)||!preg_match('/^[a-f0-9]{20}$/D',$item)||$nums['duration_days']>36500))throw new DomainException('native product and valid duration required');
        if($kind!=='profile'&&($item!==null||$nums['duration_days']!==0))throw new DomainException('profile only fields');
        return [$kind,$title,$description,$open,$close,$nums['point_amount'],$nums['step_points'],$nums['capacity'],$nums['duration_days'],$item];
    }
    public function saveDraft(array $p,?string $id=null):array{
        $this->actor();self::admin();$values=self::config($p);
        return $this->atomic(function()use($id,$values){
            if($id===null){
                $id=bin2hex(random_bytes(16));
                $this->q("INSERT INTO bpz_activity(id,kind,title,description,opens_at,closes_at,point_amount,step_points,capacity,duration_days,item_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())",array_merge([$id],$values));
            }else{
                $a=$this->activity($id,true);if($a['state']!=='draft'||$a['kind']!==$values[0])throw new DomainException('draft only');
                $this->q('UPDATE bpz_activity SET kind=?,title=?,description=?,opens_at=?,closes_at=?,point_amount=?,step_points=?,capacity=?,duration_days=?,item_id=? WHERE id=?',array_merge($values,[$id]));
            }
            return $this->activity($id);
        });
    }
    public function publish(string $id):array{
        $this->actor();self::admin();
        return $this->atomic(function()use($id){
            $a=$this->activity($id,true);if($a['state']!=='draft')throw new DomainException('draft only');
            if($a['closes_at']!==null&&$a['closes_at']<=date('Y-m-d H:i:s'))throw new DomainException('expired schedule');
            // Only free participation is presently safe to activate. Do not
            // silently turn a point transaction into a non-financial action.
            if($a['kind']!=='events'||(int)$a['point_amount']!==0)throw new DomainException('point settlement release required');
            $this->q("UPDATE bpz_activity SET state='open' WHERE id=?",[$id]);
            return $this->activity($id);
        });
    }
    public function close(string $id):array{
        $this->actor();self::admin();
        return $this->atomic(function()use($id){
            $a=$this->activity($id,true);
            if($a['state']!=='open')throw new DomainException('not open');
            if($a['kind']!=='events'||(int)$a['point_amount']!==0)throw new DomainException('settlement required');
            $this->q("UPDATE bpz_activity SET state='closed' WHERE id=?",[$id]);
            return $this->activity($id);
        });
    }
    public function list(string $kind,bool $admin=false):array{
        $this->actor();self::kind($kind);
        if($admin)self::admin();
        return $this->q("SELECT id,kind,title,description,state,opens_at,closes_at,point_amount,step_points,capacity,duration_days,item_id FROM bpz_activity WHERE kind=?".($admin?'':" AND state IN ('open','closed') AND opens_at<=NOW()")." ORDER BY created_at DESC,id LIMIT 100",[$kind])->fetchAll(PDO::FETCH_ASSOC);
    }
    public function joinEvent(string $id,string $request):array{
        $member=$this->actor();self::id($request);
        return $this->atomic(function()use($id,$request,$member){
            $a=$this->activity($id,true);
            $prior=$this->q('SELECT * FROM bpz_participation WHERE mb_id=? AND request_id=?',[$member,$request])->fetch(PDO::FETCH_ASSOC);
            if($prior){if($prior['activity_id']!==$id)throw new DomainException('request conflict');return $prior;}
            if($a['kind']!=='events'||$a['state']!=='open'||((int)$a['point_amount']!==0&&!(getenv('BUSAN_FIXTURE_DB')==='pointzone_fixture'&&$this->db->query('SELECT DATABASE()')->fetchColumn()==='pointzone_fixture'))||$a['opens_at']>date('Y-m-d H:i:s')||($a['closes_at']!==null&&$a['closes_at']<=date('Y-m-d H:i:s')))throw new DomainException('event unavailable');
            $prior=$this->q("SELECT * FROM bpz_participation WHERE activity_id=? AND mb_id=? AND state IN ('confirmed','pending','awarded') LIMIT 1",[$id,$member])->fetch(PDO::FETCH_ASSOC);
            if($prior)return $prior;
            $n=(int)$this->q("SELECT COUNT(*) FROM bpz_participation WHERE activity_id=? AND state IN ('confirmed','pending','awarded')",[$id])->fetchColumn();
            if((int)$a['capacity']>0&&$n>=(int)$a['capacity'])throw new DomainException('event full');
            $pid=bin2hex(random_bytes(16));
            $this->q("INSERT INTO bpz_participation(id,activity_id,mb_id,request_id,amount,state,created_at) VALUES(?,?,?,?,0,'confirmed',NOW())",[$pid,$id,$member,$request]);
            return $this->q('SELECT * FROM bpz_participation WHERE id=?',[$pid])->fetch(PDO::FETCH_ASSOC);
        });
    }
    public function history():array{
        return $this->q("SELECT p.id,a.kind,a.title,p.amount,p.state,p.created_at FROM bpz_participation p JOIN bpz_activity a ON a.id=p.activity_id WHERE p.mb_id=? ORDER BY p.created_at DESC,p.id LIMIT 100",[$this->actor()])->fetchAll(PDO::FETCH_ASSOC);
    }
    public function entitlements():array{
        return $this->q("SELECT e.id,a.title,e.order_id,e.starts_at,e.expires_at,CASE WHEN e.revoked_at IS NULL AND e.starts_at<=NOW() AND (e.expires_at IS NULL OR e.expires_at>NOW()) THEN 1 ELSE 0 END AS active FROM bpz_entitlement e JOIN bpz_activity a ON a.id=e.activity_id WHERE e.mb_id=? ORDER BY e.starts_at DESC LIMIT 100",[$this->actor()])->fetchAll(PDO::FETCH_ASSOC);
    }
    public function participants(string $id):array{
        $this->actor();self::admin();$this->activity($id);
        return $this->q("SELECT mb_id,amount,state,created_at FROM bpz_participation WHERE activity_id=? ORDER BY created_at,id LIMIT 200",[$id])->fetchAll(PDO::FETCH_ASSOC);
    }
    /** Candidate ranking: confirmed participation count, not point balances. */
    public function rankings():array{
        $this->actor();
        return $this->q("SELECT m.mb_nick AS nickname,COUNT(DISTINCT p.activity_id) AS activities FROM bpz_participation p JOIN g5_member m ON m.mb_id=p.mb_id WHERE p.state IN ('confirmed','awarded') AND m.mb_leave_date='' AND m.mb_intercept_date='' GROUP BY m.mb_id,m.mb_nick ORDER BY activities DESC,m.mb_id LIMIT 100")->fetchAll(PDO::FETCH_ASSOC);
    }
    public function equip(?string $entitlement):array{
        $m=$this->actor();
        return $this->atomic(function()use($m,$entitlement){
            if($entitlement===null){$this->q('DELETE FROM bpz_profile_selection WHERE mb_id=?',[$m]);return ['equipped'=>null];}
            $e=$this->q("SELECT e.id FROM bpz_entitlement e JOIN yc5_order o ON o.od_id=e.order_id AND o.mb_id=e.mb_id JOIN bpz_order_receipt r ON r.order_id=o.od_id AND r.member_id=o.mb_id WHERE e.id=? AND e.mb_id=? AND e.revoked_at IS NULL AND e.starts_at<=NOW() AND (e.expires_at IS NULL OR e.expires_at>NOW()) AND o.od_status IN ('입금','완료') AND JSON_UNQUOTE(JSON_EXTRACT(r.receipt,'$.state'))='paid' FOR UPDATE",[self::id($entitlement),$m])->fetchColumn();
            if(!$e)throw new DomainException('item not owned or expired');
            $this->q('INSERT INTO bpz_profile_selection(mb_id,entitlement_id) VALUES(?,?) ON DUPLICATE KEY UPDATE entitlement_id=VALUES(entitlement_id)',[$m,$e]);return ['equipped'=>$e];
        });
    }
    public function equipped():?array{
        $r=$this->q("SELECT e.id,a.title FROM bpz_profile_selection s JOIN bpz_entitlement e ON e.id=s.entitlement_id AND e.mb_id=s.mb_id JOIN bpz_activity a ON a.id=e.activity_id JOIN yc5_order o ON o.od_id=e.order_id AND o.mb_id=e.mb_id JOIN bpz_order_receipt r ON r.order_id=o.od_id AND r.member_id=o.mb_id WHERE s.mb_id=? AND e.revoked_at IS NULL AND e.starts_at<=NOW() AND (e.expires_at IS NULL OR e.expires_at>NOW()) AND o.od_status IN ('입금','완료') AND JSON_UNQUOTE(JSON_EXTRACT(r.receipt,'$.state'))='paid'",[$this->actor()])->fetch(PDO::FETCH_ASSOC);
        return $r?:null;
    }

    /** Derive entitlement from a verified native paid order, not a supplied price.
     * One entitlement per order/activity. Duration begins at native payment time. */
    public function claimProfile(string $activity,string $order):array{
        $m=$this->actor();self::id($activity);
        if(!preg_match('/^[1-9][0-9]{14}$/D',$order))throw new DomainException('invalid order');
        if(getenv('BUSAN_FIXTURE_DB')!=='pointzone_fixture'||$this->db->query('SELECT DATABASE()')->fetchColumn()!=='pointzone_fixture')throw new DomainException('profile fulfillment not released');
        return $this->atomic(function()use($m,$activity,$order){
            $a=$this->activity($activity,true);
            if($a['kind']!=='profile'||!in_array($a['state'],['open','closed'],true))throw new DomainException('profile unavailable');
            $r=$this->q("SELECT o.od_receipt_time,o.od_receipt_point,r.receipt FROM yc5_order o JOIN bpz_order_receipt r ON r.order_id=o.od_id AND r.member_id=o.mb_id WHERE o.od_id=? AND o.mb_id=? AND o.od_status IN ('입금','완료') AND o.od_settle_case='포인트' AND o.od_receipt_price=0 FOR UPDATE",[$order,$m])->fetch(PDO::FETCH_ASSOC);
            if(!$r)throw new DomainException('paid order required');
            $receipt=json_decode($r['receipt'],true,512,JSON_THROW_ON_ERROR);
            if(($receipt['state']??null)!=='paid'||($receipt['member']??null)!==$m||($receipt['order']??null)!==$order||($receipt['amount']??null)!==(int)$r['od_receipt_point'])throw new DomainException('receipt conflict');
            require_once __DIR__.'/existing-points.php';
            $e=BusanExistingPoints::native()->evidence($m,$order,'purchase',-(int)$r['od_receipt_point']);
            if(!$e||$e['id']!==($receipt['point_id']??null))throw new DomainException('native payment evidence required');
            $line=$this->q("SELECT COUNT(*) FROM yc5_cart WHERE od_id=? AND mb_id=? AND it_id=? AND ct_qty=1 AND ct_status IN ('입금','완료') AND ct_stock_use=1",[$order,$m,$a['item_id']])->fetchColumn();
            if((int)$line!==1)throw new DomainException('matching item required');
            $old=$this->q('SELECT * FROM bpz_entitlement WHERE order_id=? AND activity_id=?',[$order,$activity])->fetch(PDO::FETCH_ASSOC);
            if($old)return $old;
            $starts=self::date($r['od_receipt_time']);$expiry=(int)$a['duration_days']===0?null:(new DateTimeImmutable($starts))->modify('+'.(int)$a['duration_days'].' days')->format('Y-m-d H:i:s');
            $id=bin2hex(random_bytes(16));
            $this->q('INSERT INTO bpz_entitlement(id,activity_id,mb_id,order_id,starts_at,expires_at) VALUES(?,?,?,?,?,?)',[$id,$activity,$m,$order,$starts,$expiry]);
            return $this->q('SELECT * FROM bpz_entitlement WHERE id=?',[$id])->fetch(PDO::FETCH_ASSOC);
        });
    }

}

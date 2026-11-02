<?php
declare(strict_types=1);
require_once __DIR__.'/vip-store-core.php';

function ng_key(string $id):string {
    ns_order_key($id);
    return 'store:gift:'.$id;
}
function ng_shift(int $time,int $months):int {
    $date=(new DateTimeImmutable('@'.$time))->setTimezone(new DateTimeZone('Asia/Seoul'));
    $first=$date->modify('first day of this month')->modify(sprintf('%+d months',$months));
    return $first->setDate((int)$first->format('Y'),(int)$first->format('n'),min((int)$date->format('j'),(int)$first->format('t')))->getTimestamp();
}
function ng_active_member(string $id):array {
    $m=ns_one('SELECT mb_id,mb_nick,mb_level FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id)." AND mb_level>=2 AND COALESCE(mb_leave_date,'')='' AND COALESCE(mb_intercept_date,'')=''");
    if(!$m)throw new DomainException('recipient_unavailable');
    return $m;
}
function ng_recipient(string $sender,string $id,?string $plan=null):array {
    $m=ng_active_member($id);
    if($m['mb_id']===$sender)throw new DomainException('self_gift');
    if($plan!==null){
        $levels=$plan==='creator'?[7,8]:[2,3,4];
        if(!in_array((int)$m['mb_level'],$levels,true)||$m['mb_id']===($GLOBALS['config']['cf_admin']??''))throw new DomainException('recipient_plan');
    }
    return $m;
}
function ng_new(string $id,string $sender,string $recipient,string $name,int $now):array {
    $expires=ng_shift($now,12);
    return ['id'=>$id,'sender'=>$sender,'recipient'=>$recipient,'name'=>$name,'sentAt'=>$now,'expiresAt'=>$expires,'remindAt'=>ng_shift($expires,-1),'usedAt'=>null,'canceled'=>false];
}
function ng_status(array $g,int $now):string {
    if($g['canceled'])return 'canceled';
    if($g['usedAt']!==null)return 'used';
    return $now >= $g['expiresAt']?'expired':'available';
}
function ng_buy_vip(string $sender,string $id,string $product,string $to,int $now):array {
    $catalog=nv_products();
    if(!isset($catalog[$product]))throw new InvalidArgumentException('invalid_product');
    $item=$catalog[$product];
    return ns_atomic($sender,true,function()use($sender,$id,$item,$to,$now){
        $key=ng_key($id);
        $old=ns_doc($key,true);
        if($old){
            $g=$old['data'];
            if($g['sender']!==$sender||$g['recipient']!==$to||$g['product']!==$item['id'])throw new DomainException('purchase_conflict');
            return $g;
        }
        if(empty(nr_policy()['enabled']))throw new DomainException('membership_not_ready');
        nr_member($sender);
        $recipient=ng_recipient($sender,$to,$item['plan']);
        $g=ng_new($id,$sender,$recipient['mb_id'],$item['name'],$now)+['product'=>$item['id'],'kind'=>'vip','plan'=>$item['plan'],'days'=>$item['durationDays'],'price'=>$item['points']];
        ns_points_debit($sender,$item['points'],$id,'NOA VIP 이용권 선물');
        ns_put($key,'store_gift',$g,0,$sender);
        nr_sync_member($sender,$now);
        return $g;
    });
}
// Called only within the verified live payment transaction. Reversals affect the
// outstanding voucher, or the recipient ledger when the voucher was already used.
function ng_settle_points(array $order,int $reversed,int $bonusReversed,int $now):void {
    $id=$order['id'];$key=ng_key($id);$row=ns_doc($key,true);
    if(!$row&&$reversed===$order['priceWon'])return;
    $g=$row['data']??(ng_new($id,$order['ownerId'],$order['giftRecipient'],'포인트 충전권',$now)+['product'=>$order['productId'],'kind'=>'points','points'=>$order['totalPoints'],'price'=>$order['priceWon']]);
    if($g['kind']!=='points'||$g['sender']!==$order['ownerId']||$g['recipient']!==$order['giftRecipient'])throw new DomainException('purchase_conflict');
    $remaining=$order['totalPoints']-$reversed-$bonusReversed;
    if($g['usedAt']!==null&&$remaining<$g['points']){
        nt_revoke($g['recipient'],$g['points']-$remaining,$id,'gift_cancel_'.$reversed);
        nr_sync_member($g['recipient'],$now);
    }
    $g['points']=$remaining;
    $g['canceled']=$remaining===0;
    if(!$row||$row['data']!==$g)ns_put($key,'store_gift',$g,$row['revision']??0,$g['sender']);
}
function ng_update(string $owner,string $id,string $action,int $expectedExpiry,int $now):array {
    return ns_atomic($owner,true,function()use($owner,$id,$action,$expectedExpiry,$now){
        $key=ng_key($id);$r=ns_doc($key,true);$g=$r['data']??null;
        if(!$g||$g['recipient']!==$owner)throw new DomainException('gift_not_found');
        $status=ng_status($g,$now);
        if($action==='use'&&$status==='used')return $g;
        if($status!=='available')throw new DomainException('gift_unavailable');
        if($action==='extend'){
            if($g['expiresAt']!==$expectedExpiry)throw new DomainException('gift_changed');
            $g['expiresAt']=ng_shift($g['expiresAt'],12);
            $g['remindAt']=ng_shift($g['expiresAt'],-1);
        }elseif($action==='use'){
            nr_member($owner);
            if($g['kind']==='points')nr_insert_points($owner,$g['points'],'NOA 포인트 선물 사용','noa_store_gift',$id,'redeem');
            else{
                ng_recipient($g['sender'],$owner,$g['plan']);
                ns_grant(['id'=>$id,'ownerId'=>$owner,'plan'=>$g['plan'],'durationDays'=>$g['days'],'method'=>'gift'],$owner,$now);
            }
            nr_sync_member($owner,$now);$g['usedAt']=$now;
        }else throw new InvalidArgumentException('invalid_action');
        ns_put($key,'store_gift',$g,$r['revision'],$owner);return $g;
    });
}

function ng_list(string $owner,string $box,int $page,int $now):array {
    $gifts=[];
    $field=$box==='sent'?'sender':'recipient';
    $sql="SELECT payload FROM noa_documents WHERE kind='store_gift' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.$field'))=".ns_e($owner);
    if($box==='received')$sql.=" AND CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.expiresAt')) AS UNSIGNED)>".$now;
    $q=ns_q($sql." ORDER BY CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.sentAt')) AS UNSIGNED) DESC,doc_key DESC LIMIT 21 OFFSET ".(($page-1)*20));
    while($r=sql_fetch_array($q))$gifts[]=json_decode($r['payload'],true,32,JSON_THROW_ON_ERROR);
    return $gifts;
}

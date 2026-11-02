<?php
declare(strict_types=1);
require_once __DIR__.'/gift-core.php';
function ni_key(string $token):string {
    if(!preg_match('/^[a-f0-9]{64}$/D',$token))throw new DomainException('invite_invalid');
    return 'special:invite:'.hash('sha256',$token);
}
function ni_issue(string $issuer,string $token,int $now):void {
    if(!ng_unlimited($issuer))throw new DomainException('invite_forbidden');
    $key=ni_key($token);
    ns_atomic($issuer,false,function()use($issuer,$key,$now){
        if(ns_doc($key,true))return;
        ng_active_member($issuer);
        ns_put($key,'special_invite',['sender'=>$issuer,'issuedAt'=>$now,'giftId'=>null,'claimedBy'=>null],0,$issuer);
    });
}
function ni_claim(string $owner,string $token,int $now):string {
    $key=ni_key($token);
    return ns_atomic($owner,false,function()use($owner,$key,$now){
        $record=ns_doc($key,true);
        if(!$record)throw new DomainException('invite_invalid');
        $invite=$record['data'];
        if($invite['claimedBy']!==null){
            if($invite['claimedBy']===$owner)return $invite['giftId'];
            throw new DomainException('invite_taken');
        }
        if($owner===$invite['sender'])throw new DomainException('invite_self');
        ng_active_member($owner);
        $bytes=random_bytes(16);
        $bytes[6]=chr((ord($bytes[6])&15)|64);$bytes[8]=chr((ord($bytes[8])&63)|128);
        $id=vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex($bytes),4));
        $gift=ng_new($id,$invite['sender'],$owner,'람준파파의 특별한 별무리 초대장',$now)
            +ng_item('vip30')+['funding'=>'special_invite','debitedPoints'=>0];
        ns_put(ng_key($id),'store_gift',$gift,0,$invite['sender']);
        $invite['giftId']=$id;$invite['claimedBy']=$owner;$invite['claimedAt']=$now;
        ns_put($key,'special_invite',$invite,$record['revision'],$owner);
        return $id;
    });
}

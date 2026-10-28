<?php
declare(strict_types=1);
require_once __DIR__.'/subscription-core.php';
const NMD_PRICE=1000;
const NMD_OWNER_SHARE=500;
/** Resolve a real account from explicit ownership, then verified upload provenance. */
function nmd_owner(PDO $db,array $doc,array $asset):string{
 $owner=$doc['ownerId']??'';
 if(is_string($owner)&&$owner!=='')return $owner;
 $e=json_decode($asset['source_evidence']??'null',true);$id=$e['upload_id']??'';
 if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new DomainException('song_owner_unresolved');
 $q=$db->prepare("SELECT requested_by FROM noa_jukebox_uploads WHERE id=? AND song_key=? AND source_url=? AND status='ready'");$q->execute([$id,$asset['song_key'],$asset['source_url']]);$owner=$q->fetchColumn();
 if(!is_string($owner)||$owner==='')throw new DomainException('song_owner_unresolved');return $owner;
}
function nmd_asset(PDO $db,string $key,array $member,bool $admin=false):array{
 if($key===''||strlen($key)>191)throw new DomainException('song_unavailable');
 $doc=nj_document($db,$key);$a=nj_find($db,$key);
 if(!$doc||!in_array($doc['_kind']??'',['single','story','playlist'],true)||(!noa_sound_visible($doc,$admin)&&!nam_owner($doc,$member)))throw new DomainException('song_unavailable');
 if(!$a||!hash_equals($a['source_url'],noa_sound_suno($doc['body']??[]))||!nj_verified($a,'audio'))throw new DomainException('audio_unavailable');
 $owner=$admin?'':nmd_owner($db,$doc,$a);
 return ['key'=>$key,'sha'=>$a['audio_sha256'],'path'=>$a['audio_path'],'bytes'=>(int)$a['audio_bytes'],'ownerId'=>$owner,'title'=>(string)(($doc['body']['confirmedTitle']??'')?:($doc['title']??$a['title']??'NOA'))];
}
function nmd_key(string $id):string{ns_order_key($id);return 'music:download:'.$id;}
function nmd_point(string $owner,int $amount,string $id,string $action,string $title):void{
 [$relation,$full]=ns_point_relation($id,$action);$table='noa_music_download';
 $buffer=ob_get_level();ob_start(static fn($v)=>'');try{$ok=insert_point($owner,$amount,mb_substr('NOA 음원 '.($amount<0?'다운로드':'수익').' · '.$title,0,100),$table,$relation,$full);$unexpected=ob_get_contents();}finally{while(ob_get_level()>$buffer)ob_end_clean();}
 $r=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' AND po_rel_table='.ns_e($table).' AND po_rel_id='.ns_e($relation).' AND po_rel_action='.ns_e($full));
 if($ok!==1||trim($unexpected)!==''||!$r||(int)$r['po_point']!==$amount)throw new RuntimeException('download_points_failed');
}
/** Debit, owner credit and receipt share one native DB transaction. Replays never charge again. */
function nmd_purchase(string $buyer,string $id,array $quote,callable $current,int $now):array{
 $key=nmd_key($id);
 return ns_atomic($buyer,true,function()use($buyer,$id,$key,$quote,$current,$now){
  $old=ns_doc($key,true);if($old){$d=$old['data'];if(($d['buyerId']??'')!==$buyer||$d['key']!==$quote['key']||$d['sha']!==$quote['sha'])throw new DomainException('purchase_conflict');return $d;}
  $a=$current();foreach(['key','sha','ownerId']as $field)if(!hash_equals((string)$quote[$field],(string)$a[$field]))throw new DomainException('audio_changed');
  $owners=array_unique([$buyer,$a['ownerId']]);sort($owners,SORT_STRING);
  foreach($owners as $owner){$m=ns_one('SELECT mb_id,mb_level FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($owner).' FOR UPDATE');if(!$m||(int)$m['mb_level']<2)throw new DomainException('song_owner_unresolved');ns_q('SELECT po_id FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' FOR UPDATE');}
  if((int)get_point_sum($buyer)<NMD_PRICE)throw new DomainException('insufficient_points');
  nmd_point($buyer,-NMD_PRICE,$id,'download',$a['title']);nmd_point($a['ownerId'],NMD_OWNER_SHARE,$id,'owner_share',$a['title']);
  $d=$a+['id'=>$id,'buyerId'=>$buyer,'points'=>NMD_PRICE,'ownerPoints'=>NMD_OWNER_SHARE,'createdAt'=>$now];ns_put($key,'music_download',$d,0,$buyer);return $d;
 });
}
function nmd_receipt(string $buyer,string $id,string $songKey):array{
 $r=ns_doc(nmd_key($id));$d=$r['data']??[];if(($d['buyerId']??'')!==$buyer||($d['key']??'')!==$songKey)throw new DomainException('download_receipt_required');return $d;
}

<?php
declare(strict_types=1);
/** Request consent, reply attachments and per-request playback authorization. */
function nc_is_creator():bool{global $member;return nc_admin()||(!empty($member['mb_id'])&&in_array((int)($member['mb_level']??1),[5,6],true));}
function nc_request_row(int $id):array{return $id>0?nc_one('SELECT wr_id,mb_id,wr_password,wr_8 FROM '.nc_write_table(NC_REQUEST_BOARD)." WHERE wr_id=$id AND wr_is_comment=0"):[];}
function nc_verified(int $id):?array{
 global $member;$v=$_SESSION['noa_request_verified'][$id]??null;$r=nc_request_row($id);
 if(!$v||!$r||empty($member['mb_id'])||($v['until']??0)<time()||$r['mb_id']!==(string)$member['mb_id']||($v['mb_id']??'')!==$r['mb_id']||!hash_equals((string)$r['wr_password'],(string)($v['wr_password']??'')))return null;
 return $r;
}
function nc_owner_verified(int $id):bool{return nc_verified($id)!==null;}
function nc_creator_shared(int $id):bool{return nc_is_creator()&&(nc_request_row($id)['wr_8']??'')==='NOA-CREATOR-SHARED';}
function nc_share(int $id,bool $shared):array{
 nc_board(NC_REQUEST_BOARD);$v=nc_verified($id);if(!$v)throw new DomainException('password_not_verified');
 nc_query('UPDATE '.nc_write_table(NC_REQUEST_BOARD).' SET wr_8='.nc_q($shared?'NOA-CREATOR-SHARED':'')." WHERE wr_id=$id AND wr_is_comment=0 AND mb_id=".nc_q($v['mb_id']));
 return nc_content(NC_REQUEST_BOARD,$id,$v);
}
function nc_music(string $key,bool $own=false):array{
 global $member;if($key===''||strlen($key)>191)throw new DomainException('music_not_available');
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 $db=noa_bridge_pdo();$doc=nj_document($db,$key);
 if(!$doc||!in_array($doc['_kind']??'',['single','story'],true)||!noa_sound_visible($doc,false)||($own&&!nc_admin()&&!nam_owner($doc,(array)$member)))throw new DomainException('own_ready_music_required');
 $asset=nj_find($db,$key);if(!$asset||!hash_equals(nj_asset_source($asset,'audio'),noa_sound_suno($doc['body']??[]))||!nj_verified($asset,'audio')||!nj_file($asset['audio_path']))throw new DomainException('music_not_ready');
 $title=(string)(($doc['body']['confirmedTitle']??'')?:($doc['title']??'음악'));
 return ['key'=>$key,'title'=>$title,'cover'=>'/noa-app/jukebox/stream.php?'.http_build_query(['key'=>$key,'type'=>'cover']),'href'=>'/noa-music.php?track='.rawurlencode($key)];
}
function nc_reply_card(string $key,int $request):?array{
 if($key==='')return null;try{$music=nc_music($key);$music['audio']='/noa-bridge/community-audio.php?'.http_build_query(['request'=>$request,'key'=>$key]);return $music;}catch(DomainException $e){return ['key'=>$key,'title'=>'첨부곡을 현재 재생할 수 없습니다.','unavailable'=>true];}
}
function nc_music_search(string $term):array{
 global $member;if(!nc_is_creator())throw new DomainException('comment_not_allowed');if(mb_strlen($term)>80)throw new DomainException('invalid_input');
 require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 // Use the same merged document/catalog identities as the music player.
 $needle=mb_strtolower(preg_replace('/\s+/u','',trim($term)));$out=[];
 foreach(nj_catalog(noa_bridge_pdo()) as $key=>$doc){
  if(!$doc||(!nc_admin()&&!nam_owner($doc,(array)$member))||!noa_sound_visible($doc,false))continue;
  $title=(string)(($doc['body']['confirmedTitle']??'')?:($doc['title']??''));
  $haystack=mb_strtolower(preg_replace('/\s+/u','',$title.' '.($doc['title']??'')));
  if($needle!==''&&!str_contains($haystack,$needle))continue;
  try{$out[]=nc_music((string)$key,true);}catch(DomainException $e){continue;}
  if(count($out)>=20)break;
 }
 return $out;
}
function nc_request_audio_allowed(int $id,string $key):bool{
 if(!nc_admin()&&!nc_owner_verified($id)&&!nc_creator_shared($id))return false;
 return (bool)nc_one('SELECT wr_id FROM '.nc_write_table(NC_REQUEST_BOARD)." WHERE wr_parent=$id AND wr_is_comment=1 AND wr_9=".nc_q($key).' LIMIT 1');
}

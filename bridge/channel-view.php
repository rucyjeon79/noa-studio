<?php
declare(strict_types=1);
require_once __DIR__.'/creator-core.php';
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/music-readmodel.php';
/** A public projection: no private keys, author identifiers or creative prompts. */
function ncv_project(array $records,array $aliases,string $channelId,callable $media):array{
 $songs=[];$lists=[];$visible=[];
 foreach($records as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
  if(!noa_sound_visible($d,false)||($d['visibility']??'public')!=='public'||!hash_equals($channelId,hash('sha256',(string)($d['ownerId']??''))))continue;
  if(!in_array($r['kind'],['single','story','playlist'],true))continue;
  $key=$r['doc_key'];$item=['key'=>$key,'kind'=>$r['kind'],'title'=>nup_fields($d)['title']?:($d['title']??'제목 없음'),'genre'=>(string)($d['genreId']??''),'ep'=>(int)($d['ep']??0),'act'=>(int)($d['act']??0)];
  if($r['kind']==='playlist'){$item['members']=is_array($d['body']['members']??null)?$d['body']['members']:[];$lists[]=$item;continue;}
  if($item['genre']==='cover-reborn'){
   $item['originalArtist']=noa_music_original_artist($d['body']??[]);
   $item['title']=noa_music_display_title($item);
  }
  $asset=$media($key,$d);if(!$asset)continue;
  $item['aliases']=array_values(array_unique(array_merge([$key],$aliases[$key]??[])));foreach($item['aliases'] as $a)$visible[$a]=true;
  $songs[]=array_merge($item,$asset,['youtube'=>'/noa-youtube.php?track='.rawurlencode('coming:'.hash('sha256','song:'.$key))]);
 }
 foreach($lists as &$list){$hadMembers=!empty($list['members']);$list['members']=array_values(array_filter(array_map(static fn($m)=>is_array($m)&&is_string($m['key']??null)&&isset($visible[$m['key']])?['key'=>$m['key']]:null,$list['members'])));if($hadMembers&&!$list['members'])$list['act']=0;}unset($list);
 return array_merge($songs,$lists);
}
function ncv_records(PDO $db,array $channel,bool $canPlay):array{
 $owner=(string)($channel['document']['ownerId']??'');$id=substr($channel['doc_key'],strlen('creator-channel:'));if($owner===''||!hash_equals($id,hash('sha256',$owner)))throw new DomainException('channel_owner_mismatch');
 $records=nc_owned_records($db,$owner);$aliases=nc_record_aliases($db,$records);$assets=nj_assets($db);
 return ncv_project($records,$aliases,$id,static function(string $key,array $d)use($assets,$owner,$canPlay,$channel){
  $source=noa_sound_suno($d['body']??[]);$audio=noa_music_asset_url($assets,$key,$source,'audio');if($audio==='')return null;
  $cover=noa_music_cover($assets,$key,$source,$d['body']??[],$owner);if(str_starts_with($cover,'/noa-creator-symbol.php'))$cover.='&v='.$channel['revision'];
  return ['audio'=>$canPlay?$audio:'','cover'=>$cover];
 });
}

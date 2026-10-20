<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function nc_json(mixed $v):string{return json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function nc_hash(mixed $v):string{return hash('sha256',nc_json($v));}
function nc_text(mixed $v):string{return is_string($v)?trim(str_replace(["\r\n","\r"],"\n",$v)):'';}
function nc_lines(string $v):array{return explode("\n",str_replace(['\\r\\n','\\n'],"\n",$v));}
function nc_language(string $genre,array $d,array $b):string{return nc_text($d['language']??$b['language']??'')?:match($genre){'jpop-original'=>'ja','pop-original','groovy-airy-pop','narrative-piano-indie'=>'en','thai-original'=>'th',default=>'ko'};}
function nc_identity(array $d,string $path,string $kind=''):array{
 $b=$d['body']??$d['pkg']??$d;if(!is_array($b))$b=[];
 $parts=explode('/',str_replace('原곡정보','원곡정보',$path));$genre=nc_text($d['genreId']??$d['genre_id']??'');
 if(!$genre&&count($parts)>=3&&in_array($parts[0],['곡','원곡정보','genres','songs','playlists'],true))$genre=$parts[1];
 if(!$genre)$genre=nc_text($b['genreId']??'');if(!$genre||!preg_match('/^[a-z0-9-]{1,64}$/D',$genre))return [];
 $ep=nc_text((string)($d['ep']??$d['n']??''));if(!$ep&&preg_match('~/(?:ep/)?([0-9]{1,3})[.]json$~D',$path,$m)&&!str_contains($path,'act-'))$ep=$m[1];
 if($ep!==''&&ctype_digit($ep))$ep=str_pad((string)(int)$ep,2,'0',STR_PAD_LEFT);
 $act=(int)($d['act']??0);if(!$act&&preg_match('~act-([0-9]+)[.]json$~D',$path,$m))$act=(int)$m[1];
 $language=nc_language($genre,$d,$b);$version=nc_text($d['version']??$b['version']??'')?:'unspecified';
 $playlist=$kind==='playlist'||$act>0||str_starts_with(nc_text($d['title']??''),'playlist:')||str_contains(basename($path),'플레이리스트')||is_array($b['songs']??null);
 $type=$playlist?'playlist':'song';$explicit=nc_text($b['songId']??$d['songId']??$d['id']??'');
 if($playlist)$key=$act?'act:'.$genre.':'.$act:($explicit?:'path:'.$path);
 elseif($ep!=='')$key='ep:'.$genre.':'.$ep;
 else $key=$explicit?'id:'.$explicit:'path:'.$path;
 $identity=[$type,$genre,$language,$version,$key];return ['id'=>nc_hash($identity),'identity'=>$identity,'type'=>$type,'genre'=>$genre,'language'=>$language,'version'=>$version,'ep'=>$ep,'act'=>$act,'body'=>$b,'document'=>$d];
}
function nc_add(array &$entities,array $identity,array $body,string $source):void{
 $id=$identity['id'];if(!isset($entities[$id]))$entities[$id]=array_diff_key($identity,['body'=>1,'document'=>1])+['candidates'=>[],'sources'=>[],'sequences'=>[],'aliases'=>[]];
 $e=&$entities[$id];$e['sources'][$source]=true;
 $fields=$body;
 // Explicitly collect both title variants; neither is silently preferred if they disagree.
 unset($fields['title'],$fields['confirmedTitle']);
 foreach(['title'=>$identity['document']['title']??'','confirmedTitle'=>$body['confirmedTitle']??''] as $label=>$title)if(nc_text($title)!=='')nc_candidate($e,'title',$title,$source.':'.$label);
 if(isset($identity['document']['lyrics']))nc_candidate($e,'lyricsBlock',$identity['document']['lyrics'],$source.':lyrics');
 foreach($fields as $field=>$value){if(in_array($field,['adminDevice','securityKey','gatePassword','password','token'],true))continue;nc_candidate($e,(string)$field,$value,$source.':'.$field);}
 if($identity['type']==='playlist'){
  $sequence=[];
  if(is_array($body['songs']??null)){
   foreach($body['songs'] as $item)$sequence[]=is_array($item)?$item:['title'=>(string)$item];
  }elseif(is_string($body['tracklist']??null)){
   foreach(nc_lines($body['tracklist']) as $line){$line=trim($line);if($line==='')continue;$item=['raw'=>$line];if(preg_match('/^\s*(?:[-*]\s*)?EP\s*[.]?\s*([0-9]{1,3})\s*[:.\-–—|]?\s*(.*)$/iu',$line,$m)){$item['ep']=str_pad((string)(int)$m[1],2,'0',STR_PAD_LEFT);$item['title']=trim($m[2]);}elseif(preg_match('/^(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/u',$line,$m)){$item['startSeconds']=(int)($m[1]?:0)*3600+(int)$m[2]*60+(int)$m[3];$item['title']=$m[4];}else $item['title']=$line;$sequence[]=$item;}
  }
  if($sequence){$hash=nc_hash($sequence);$e['sequences'][$hash]['items']=$sequence;$e['sequences'][$hash]['sources'][$source]=true;}
 }
}
function nc_candidate(array &$e,string $field,mixed $value,string $source):void{
 if($value===null||$value===''||$value===[]||is_string($value)&&trim($value)==='')return;
 $canonical=is_string($value)?nc_text($value):$value;
 // Line-ending normalization is only for comparison; original source bytes are retained.
 if(in_array($field,['lyricsBlock','tracklist','sourceLyrics'],true)&&is_string($canonical))$canonical=implode("\n",nc_lines($canonical));
 $key=nc_hash($canonical);$e['candidates'][$field][$key]['value']=$canonical;$e['candidates'][$field][$key]['sources'][$source]=true;
}
function nc_merge(array $sources,array $limits=[]):array{
 $entities=[];$kept=[];$unidentified=[];
 foreach($sources as $s){$raw=base64_decode($s['raw'],true);if($raw===false||hash('sha256',$raw)!==$s['sha256'])throw new RuntimeException('source_integrity_failure');$d=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($d))throw new RuntimeException('source_object_required');$s['id']=nc_hash([$s['namespace'],$s['path'],$s['sha256']]);$kept[$s['id']]=$s;$identity=nc_identity($d,$s['path'],$s['kind']??'');if(!$identity){$unidentified[]=$s['id'];continue;}nc_add($entities,$identity,$identity['body'],$s['id']);if(!empty($s['legacyKey']))$entities[$identity['id']]['aliases'][$s['legacyKey']]=true;if(!empty($s['publicVerified']))$entities[$identity['id']]['publicVerified']=true;if(!empty($d['ownerId']))$entities[$identity['id']]['ownerId']=$d['ownerId'];}
 // EP references establish identity even when only a title was retained in an ACT.
 foreach(array_values($entities) as $list){if($list['type']!=='playlist')continue;foreach($list['sequences'] as $sequence)foreach($sequence['items'] as $item){$ep=(string)($item['ep']??'');if($ep==='')continue;$d=['genreId'=>$list['genre'],'language'=>$list['language'],'version'=>$list['version'],'ep'=>$ep,'title'=>$item['title']??'','pkg'=>[]];$i=nc_identity($d,'track-reference/'.$ep);nc_add($entities,$i,[],'playlist:'.$list['id']);}}
 $conflicts=[];$songIndex=[];$titles=[];$aliases=[];
 foreach($entities as $id=>&$e){$e['fields']=[];$e['reviewFields']=[];foreach($e['candidates'] as $field=>$variants){if(count($variants)===1)$e['fields'][$field]=array_values($variants)[0]['value'];else{$e['reviewFields'][]=$field;$conflicts[]=['id'=>nc_hash([$id,$field,$variants]),'entity'=>$id,'field'=>$field,'alternatives'=>array_values($variants)];}}
  if($e['type']==='song'){foreach(array_keys($e['aliases']) as $alias)$aliases[$alias][$id]=true;if($e['ep']!=='')$songIndex[nc_hash([$e['genre'],$e['language'],$e['version'],$e['ep']])]=$id;foreach($e['candidates']['title']??[] as $v)$titles[nc_hash([$e['genre'],$e['language'],$e['version'],mb_strtolower(nc_text($v['value']))])][$id]=true;}
 }unset($e);
 $relations=[];$lists=[];$songCount=0;$partial=0;$reviewSongs=[];$sourceSongs=0;
 foreach($entities as $id=>&$e){if($e['type']==='song'){$songCount++;if(empty($e['fields']['title'])||empty($e['fields']['lyricsBlock'])||empty($e['fields']['sunoUrl'])&&empty($e['fields']['sunoShareUrl'])||empty($e['fields']['youtubeUrl']))$partial++;if($e['reviewFields'])$reviewSongs[$id]=true;$sourceSongs+=count(array_filter(array_keys($e['sources']),fn($source)=>!str_starts_with($source,'playlist:')));continue;}
  $variant=0;$resolvedCount=0;$unresolved=0;foreach($e['sequences'] as $sequenceHash=>$sequence){$variant++;$position=0;foreach($sequence['items'] as $item){$position++;$song=null;$status='unresolved';if(!empty($item['legacyKey'])){$matches=array_keys($aliases[$item['legacyKey']]??[]);if(count($matches)===1)$song=$matches[0];}if(!$song&&!empty($item['ep']))$song=$songIndex[nc_hash([$e['genre'],$e['language'],$e['version'],str_pad((string)(int)$item['ep'],2,'0',STR_PAD_LEFT)])]??null;
   if(!$song&&!empty($item['title'])){$matches=array_keys($titles[nc_hash([$e['genre'],$e['language'],$e['version'],mb_strtolower(nc_text($item['title']))])]??[]);if(count($matches)===1)$song=$matches[0];}
   if($song){$status=count($e['sequences'])===1?'verified':'order_review';if($variant===1)$resolvedCount++;}elseif($variant===1)$unresolved++;
   $relations[]=['playlist'=>$id,'variant'=>$sequenceHash,'position'=>$position,'song'=>$song,'raw'=>$item,'status'=>$status,'sources'=>array_keys($sequence['sources'])];
  }}
  if(count($e['sequences'])>1){$e['reviewFields'][]='trackOrder';$conflicts[]=['id'=>nc_hash([$id,'trackOrder',$e['sequences']]),'entity'=>$id,'field'=>'trackOrder','alternatives'=>array_values($e['sequences'])];}
  $lists[]=['id'=>$id,'genre'=>$e['genre'],'act'=>$e['act'],'title'=>$e['fields']['title']??null,'variants'=>count($e['sequences']),'tracks'=>$resolvedCount,'unresolved'=>$unresolved,'orderVerified'=>count($e['sequences'])===1&&$unresolved===0,'sequenceHashes'=>array_keys($e['sequences'])];
 }unset($e);ksort($entities);ksort($kept);
 $digest=nc_hash([array_map(fn($s)=>[$s['id'],$s['sha256']],array_values($kept)),'catalog-merge-v1']);
 return ['schema'=>1,'digest'=>$digest,'sources'=>array_values($kept),'entities'=>array_values($entities),'relations'=>$relations,'conflicts'=>$conflicts,'report'=>['sourceOccurrences'=>count($sources),'uniqueSourceBytes'=>count(array_unique(array_column($sources,'sha256'))),'sourceSongOccurrences'=>$sourceSongs,'songs'=>$songCount,'duplicateSongOccurrencesMerged'=>max(0,$sourceSongs-$songCount),'incompleteSongs'=>$partial,'incompleteDefinition'=>'missing any of resolved title, lyrics, Suno URL or YouTube URL; retained despite missing fields','reviewSongs'=>count($reviewSongs),'conflictFields'=>count($conflicts),'acts'=>count(array_filter($lists,fn($l)=>$l['act']>0)),'playlists'=>count($lists),'lists'=>$lists,'unidentifiedSources'=>$unidentified,'limits'=>$limits]];
}

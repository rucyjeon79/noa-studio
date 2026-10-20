<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/youtube-store.php';
/** Recovery is a new immutable catalog edition, never an UPDATE of source/user documents. */
function nr_seconds(string $iso):int{try{$d=new DateInterval($iso);return $d->d*86400+$d->h*3600+$d->i*60+$d->s;}catch(Throwable){return 0;}}
function nr_kind(array $v):string{
 $t=(string)($v['snippet']['title']??'');$d=(string)($v['snippet']['description']??'');
 if(preg_match('~Which Part Is Best|NOA Dance|Dance Vibes~iu',$t))return 'promotion';
 if(preg_match('~Playlist|몰아보기|총집편|참가곡\s*3곡|ACT[.\s]*\d~iu',$t))return 'compilation';
 if(str_starts_with($t,'[세로]')&&!preg_match('~AI.?noa|람준파파~iu',$t))return 'review';
 $seconds=nr_seconds($v['contentDetails']['duration']??'');
 if(($v['snippet']['categoryId']??'')==='10'&&preg_match('~Cover by AI.?noa|AI 작곡대회|Original Song|사연곡|학원가~iu',$t.'\n'.$d)&&$seconds>=45&&$seconds<=600)return 'song';
 return 'review';
}
function nr_suno_url(string $text):string{
 preg_match_all('~(?:Suno|수노)[^\r\n]{0,30}(https://(?:www[.])?suno[.]com/(?:song|s)/[A-Za-z0-9_-]+)~iu',$text,$m);
 $urls=array_values(array_unique($m[1]));return count($urls)===1?$urls[0]:'';
}
function nr_entity(array $v,string $channel):array{
 $s=$v['snippet'];$t=nc_text($s['title']??'');$text=$t.'\n'.($s['description']??'');
 $cover=(bool)preg_match('~Cover by AI.?noa~iu',$t);
 $genre=$cover?'cover-reborn':(preg_match('~사연곡|학원가~u',$t)?'your-story':'unclassified');
 $language='und';if(preg_match('~\((KR|JP|US|EN|TH)\)~i',$t,$m))$language=['KR'=>'ko','JP'=>'ja','US'=>'en','EN'=>'en','TH'=>'th'][strtoupper($m[1])];
 $ep=preg_match('~\bEP[.\s]*(\d{1,3})(?!\d)~i',$t,$m)?str_pad((string)(int)$m[1],2,'0',STR_PAD_LEFT):'';
 $id=nc_hash(['youtube-song',$channel,$v['id']]);$thumb=$s['thumbnails']['maxres']['url']??$s['thumbnails']['high']['url']??$s['thumbnails']['medium']['url']??$s['thumbnails']['default']['url']??'';
 $fields=['title'=>$t,'youtubeUrl'=>'https://www.youtube.com/watch?v='.$v['id'],'thumbUrl'=>$thumb,'description'=>$s['description']??'','publishedAt'=>$s['publishedAt']??'','privacyStatus'=>$v['status']['privacyStatus']??'private','registrationStatus'=>'needs_information','source'=>['platform'=>'youtube','channel'=>$channel,'videoId'=>$v['id']],'collection'=>$cover?'cover':($genre==='your-story'?'story':'unclassified')];
 $suno=nr_suno_url($s['description']??'');if($suno!=='')$fields['sunoShareUrl']=$suno;
 return ['id'=>$id,'identity'=>['song','youtube',$channel,$v['id']],'type'=>'song','genre'=>$genre,'language'=>$language,'version'=>$cover?'cover':'unspecified','ep'=>$ep,'act'=>0,'fields'=>$fields,'reviewFields'=>['information_incomplete'],'publicVerified'=>($v['status']['privacyStatus']??'')==='public','aliases'=>['youtube:'.$v['id']=>true]];
}
function nr_plan(PDO $db):array{
 $batch=ny_batch($db);$run=ny_latest($db);if(!$run)throw new DomainException('channel_sync_required');
 $state=lab_read();if(($state['youtubeSync']['stage']??'')!=='done')throw new DomainException('finish_channel_sync_first');
 $source=nc_prepare($db);$songs=ny_songs($db,$batch);$known=[];$q=$db->prepare('SELECT entity_id FROM noa_catalog_versions WHERE batch_id=?');$q->execute([$batch]);foreach($q as $r)$known[$r['entity_id']]=true;
 $new=[];$patch=[];$links=[];$review=[];$class=[];$counts=['grokSourceOccurrences'=>$source['report']['sourceOccurrences']??count($source['sources']),'identifiedSourceSongs'=>$source['report']['songs'],'registeredBefore'=>count($songs),'sourceMissing'=>0,'youtubeVideos'=>0,'youtubeUnregisteredSongs'=>0,'alreadyLinked'=>0,'preventedDuplicate'=>0,'nonSongVideos'=>0,'compilations'=>0,'reviewVideos'=>0];
 foreach($source['entities'] as $e)if($e['type']==='song'&&!isset($known[$e['id']])){$new[$e['id']]=$e;$counts['sourceMissing']++;}
 $videos=ny_videos($db,$run);$counts['youtubeVideos']=count($videos);
 foreach($videos as $id=>$v){$m=$v['match'];$kind=nr_kind($v);$sid=$m['songId']??null;
  if($sid&&isset($songs[$sid])){$class[$id]='A';$counts['alreadyLinked']++;$counts['preventedDuplicate']++;$fields=$songs[$sid]['fields'];$add=[];
   foreach(['youtubeUrl'=>'https://www.youtube.com/watch?v='.$id,'thumbUrl'=>$v['snippet']['thumbnails']['high']['url']??''] as $field=>$value)if(empty($fields[$field])&&!in_array($field,json_decode($songs[$sid]['review_fields'],true),true)&&$value!=='')$add[$field]=$value;
   $suno=nr_suno_url($v['snippet']['description']??'');if(empty($fields['sunoUrl'])&&empty($fields['sunoShareUrl'])&&$suno!==''&&!array_intersect(['sunoUrl','sunoShareUrl'],json_decode($songs[$sid]['review_fields'],true)))$add['sunoShareUrl']=$suno;
   if($add){foreach($add as $field=>$value){if(isset($patch[$sid][$field])&&$patch[$sid][$field]!==$value){unset($patch[$sid][$field]);$review[$id]='conflicting_supplement';continue;}$patch[$sid][$field]=$value;}$class[$id]=isset($add['youtubeUrl'])?'B':(isset($add['sunoShareUrl'])?'C':'A');}continue;
  }
  if($kind==='promotion'){$class[$id]='G';$counts['nonSongVideos']++;continue;}
  if($kind==='compilation'){$class[$id]='F';$counts['compilations']++;$review[$id]='compilation_not_single_song';continue;}
  // A title candidate or a rejected/manual classification is never silently converted into a new song.
  if(($m['candidates']??[])||in_array($m['status']??'',['rejected','conflict'],true)){$class[$id]='F';$review[$id]='existing_song_or_version_candidates';$counts['preventedDuplicate']++;continue;}
  if($kind!=='song'){$class[$id]='F';$review[$id]='music_identity_needs_review';continue;}
  $e=nr_entity($v,$run['channel_id']);
  // Same title in any candidate, including a newly recovered source, is a reason to hold, never to merge.
  $duplicate=false;foreach($new as $n)if(ny_normal($n['fields']['title']??'')===ny_normal($e['fields']['title'])){$duplicate=true;break;}
  if($duplicate){$class[$id]='F';$review[$id]='new_candidate_identity_overlap';$counts['preventedDuplicate']++;continue;}
  $new[$e['id']]=$e;$links[$id]=$e['id'];$class[$id]='E';$counts['youtubeUnregisteredSongs']++;
 }
 $patch=array_filter($patch);$counts['reviewVideos']=count($review);$counts['newSongs']=count($new);$counts['supplementSongs']=count($patch);
 $relations=[];$playlists=[];$q=$db->prepare('SELECT playlist_id,payload FROM noa_youtube_playlists WHERE run_id=? ORDER BY playlist_id');$q->execute([$run['run_id']]);$decisions=ny_decisions($db,$run['channel_id']);
 foreach($q as $p){$raw=json_decode($p['payload'],true);if(!empty($raw['systemUploads']))continue;$pid=nc_hash(['youtube-playlist',$run['channel_id'],$p['playlist_id'],$run['run_id']]);$mapped=$decisions['playlist:'.$p['playlist_id']]['entity_id']??null;
  // Separate YouTube collections retain their original zero-based positions; do not rewrite an existing ACT.
  $rows=$db->prepare('SELECT * FROM noa_youtube_items WHERE run_id=? AND playlist_id=? ORDER BY position,item_id');$rows->execute([$run['run_id'],$p['playlist_id']]);$items=[];foreach($rows as $r){$sid=$links[$r['video_id']]??($videos[$r['video_id']]['match']['songId']??null);if($sid&&isset($new[$sid])||$sid&&isset($songs[$sid]))$items[]=['sid'=>$sid,'row'=>$r];}
  if(!array_filter($items,fn($x)=>isset($new[$x['sid']])))continue;
  $playlists[$pid]=['title'=>$raw['snippet']['title']??'YouTube playlist','youtubePlaylistId'=>$p['playlist_id'],'linkedNoaPlaylist'=>$mapped,'source'=>'youtube','privacyStatus'=>$raw['status']['privacyStatus']??'private'];
  foreach($items as $x)$relations[]=['playlist'=>$pid,'song'=>$x['sid'],'position'=>(int)$x['row']['position']+1,'raw'=>['youtubeVideoId'=>$x['row']['video_id'],'youtubeItemId'=>$x['row']['item_id'],'youtubePosition'=>(int)$x['row']['position']]];
 }
 $unassigned=[];foreach($new as $sid=>$e)if(!array_filter($relations,fn($r)=>$r['song']===$sid))$unassigned[]=$sid;
 if($unassigned){$pid=nc_hash(['recovery-unclassified',$run['channel_id'],$run['run_id']]);$playlists[$pid]=['title'=>'미분류 · 정보 보완 필요','source'=>'recovery','privacyStatus'=>'private'];foreach($unassigned as $n=>$sid)$relations[]=['playlist'=>$pid,'song'=>$sid,'position'=>$n+1,'raw'=>['unclassified'=>true]];}
 $counts['newPlaylistMemberships']=count($relations);$counts['newPlaylists']=count($playlists);$counts['unclassifiedSongs']=count($unassigned);
 $p=['base'=>$batch,'run'=>$run['run_id'],'sourceGuard'=>nc_guard($db),'sourcePlan'=>$source['digest'],'counts'=>$counts,'new'=>$new,'patch'=>$patch,'links'=>$links,'classes'=>$class,'review'=>$review,'playlists'=>$playlists,'relations'=>$relations];$p['id']=nc_hash($p);return $p;
}
function nr_save(array $p):void{$file=lab_root().'/recovery-'.$p['id'].'.json';$tmp=tempnam(lab_root(),'.recovery-');chmod($tmp,0600);file_put_contents($tmp,nc_json($p),LOCK_EX);rename($tmp,$file);}
function nr_load(string $id):array{if(!preg_match('/^[a-f0-9]{64}$/D',$id))throw new InvalidArgumentException('invalid_plan');$p=json_decode((string)file_get_contents(lab_root().'/recovery-'.$id.'.json'),true,512,JSON_THROW_ON_ERROR);$copy=$p;unset($copy['id']);if(nc_hash($copy)!==$id)throw new DomainException('plan_changed');return $p;}
function nr_apply(PDO $db,array $p,string $actor):array{
 $id=$p['id'];if(!$p['new']&&!$p['patch'])return ['replayed'=>true,'report'=>$p['counts']+['registeredAfter'=>$p['counts']['registeredBefore'],'noChangesRequired'=>true]];$q=$db->prepare('SELECT report FROM noa_catalog_batches WHERE batch_id=? AND status=?');$q->execute([$id,'applied']);if($r=$q->fetchColumn())return ['replayed'=>true,'report'=>json_decode($r,true)];
 if(ny_batch($db)!==$p['base']||ny_latest($db)['run_id']!==$p['run']||nc_guard($db)!==$p['sourceGuard'])throw new DomainException('source_changed_reanalyse');
 $db->beginTransaction();try{
  // Serialize with another recovery writer; source rows stay immutable and locked during publication.
  $q=$db->prepare('SELECT batch_id FROM noa_catalog_batches WHERE batch_id=? FOR UPDATE');$q->execute([$p['base']]);
  nc_insert($db,'noa_catalog_batches',['batch_id'=>$id,'status'=>'staging','report'=>nc_json($p['counts']),'source_guard'=>$p['sourceGuard'],'created_by'=>$actor],['batch_id']);
  foreach(['noa_catalog_versions'=>['entity_id','entity_type','fields_json','fields_sha','review_fields','public_verified'],'noa_catalog_aliases'=>['alias_key','entity_id'],'noa_catalog_tracks'=>['playlist_id','variant_id','position','song_id','raw_json','status'],'noa_catalog_batch_sources'=>['source_id']] as $table=>$cols){$sql='INSERT INTO '.$table.'(batch_id,'.implode(',',$cols).') SELECT ?,'.implode(',',$cols).' FROM '.$table.' WHERE batch_id=?';$db->prepare($sql)->execute([$id,$p['base']]);}
  foreach($p['patch'] as $sid=>$add){$q=$db->prepare('SELECT fields_json FROM noa_catalog_versions WHERE batch_id=? AND entity_id=?');$q->execute([$id,$sid]);$f=json_decode($q->fetchColumn(),true);foreach($add as $k=>$v){if(!empty($f[$k]))throw new DomainException('would_overwrite_field');$f[$k]=$v;}$db->prepare('UPDATE noa_catalog_versions SET fields_json=?,fields_sha=? WHERE batch_id=? AND entity_id=?')->execute([nc_json($f),nc_hash($f),$id,$sid]);}
  foreach($p['new'] as $e){nc_insert($db,'noa_catalog_songs',['song_id'=>$e['id'],'identity_json'=>nc_json($e['identity']),'genre_id'=>$e['genre'],'language'=>$e['language'],'version_name'=>$e['version'],'ep'=>$e['ep']],['song_id']);nc_insert($db,'noa_catalog_versions',['batch_id'=>$id,'entity_id'=>$e['id'],'entity_type'=>'song','fields_json'=>nc_json($e['fields']),'fields_sha'=>nc_hash($e['fields']),'review_fields'=>nc_json($e['reviewFields']),'public_verified'=>!empty($e['publicVerified'])?1:0],['batch_id','entity_id']);foreach(array_keys($e['aliases']) as $a)nc_insert($db,'noa_catalog_aliases',['batch_id'=>$id,'alias_key'=>$a,'entity_id'=>$e['id']],['batch_id','alias_key','entity_id']);}
  foreach($p['playlists'] as $pid=>$f){nc_insert($db,'noa_catalog_playlists',['playlist_id'=>$pid,'identity_json'=>nc_json(['recovery-playlist',$pid]),'act_id'=>null,'owner_id'=>null],['playlist_id']);nc_insert($db,'noa_catalog_versions',['batch_id'=>$id,'entity_id'=>$pid,'entity_type'=>'playlist','fields_json'=>nc_json($f),'fields_sha'=>nc_hash($f),'review_fields'=>'[]','public_verified'=>0],['batch_id','entity_id']);}
  foreach($p['relations'] as $r)nc_insert($db,'noa_catalog_tracks',['batch_id'=>$id,'playlist_id'=>$r['playlist'],'variant_id'=>nc_hash(['youtube-order',$r['playlist']]),'position'=>$r['position'],'song_id'=>$r['song'],'raw_json'=>nc_json($r['raw']),'status'=>'verified'],['batch_id','playlist_id','variant_id','position']);
  // Preserve existing unresolved conflict evidence in the new edition as well.
  $db->prepare('INSERT INTO noa_catalog_conflicts SELECT ?,conflict_id,entity_id,field_name,alternatives,status,resolution,resolved_by,resolved_at FROM noa_catalog_conflicts WHERE batch_id=?')->execute([$id,$p['base']]);
  if(nc_guard($db)!==$p['sourceGuard'])throw new DomainException('original_documents_changed');
  $after=ny_songs($db,$id);if(count($after)!==$p['counts']['registeredBefore']+count($p['new']))throw new RuntimeException('song_count_verification_failed');
  $q=$db->prepare('SELECT report FROM noa_catalog_batches WHERE batch_id=?');$q->execute([$p['base']]);$baseReport=json_decode($q->fetchColumn(),true);$report=array_merge($baseReport,$p['counts'],['songs'=>count($after),'playlists'=>($baseReport['playlists']??0)+count($p['playlists']),'registeredAfter'=>count($after),'sourceMissingRemaining'=>0,'reviewRemaining'=>count($p['review']),'recoveryPlan'=>$id,'baseBatch'=>$p['base'],'youtubeRun'=>$p['run']]);
  $db->prepare('UPDATE noa_catalog_batches SET status=?,report=?,applied_at=CURRENT_TIMESTAMP WHERE batch_id=?')->execute(['applied',nc_json($report),$id]);$db->commit();return ['replayed'=>false,'report'=>$report];
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

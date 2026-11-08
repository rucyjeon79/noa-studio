<?php
// Final acknowledgment is tied to the current revision, not to a mandatory recording.
$infoId='1234567890abcdef1234567890abcdef';$info=ncd_create($db,$owner,$infoId,'음원이 없어도 곡정보를 먼저 저장');
$infoDoc=ncd_fields($info['document'],array_intersect_key(nup_fields($r['document']),array_flip(array_merge(NCD_TARGETS,['vocal']))));
$infoDoc['_creative']['intent']=$r['document']['_creative']['intent'];$infoDoc['_creative']['intentConfirmed']=true;$infoDoc['_creative']['needsReview']=['description'=>'최신 제목 확인'];
$info=ncd_atomic($db,fn()=>ncd_put($db,$info,$infoDoc,$owner));
check(in_array('review_related_fields',ncd_validation($db,$info,true)['issues'],true),'review remains advisory until explicit final click');
$infoPreview=ncd_preview($db,$owner,['id'=>$infoId,'revision'=>$info['revision'],'reviewConfirmed'=>true],true);check($infoPreview['preview']['validation']['ready'],'final click acknowledges current fields');
$infoRequest=['id'=>$infoId,'revision'=>$infoPreview['draft']['revision'],'token'=>$infoPreview['preview']['token'],'rightsConfirmed'=>true];
denied(fn()=>ncd_publish($db,$owner,array_replace($infoRequest,['revision'=>$info['revision']]),true),'revision_conflict');
$infoResult=ncd_publish($db,$owner,$infoRequest,true);$infoKey=$infoResult['publication']['key'];
check(nj_find($db,$infoKey)===null,'no fabricated media row');check(nj_document($db,$infoKey)['genreId']==='your-story','chosen category saved');
check(ncd_publish($db,$owner,$infoRequest,true)['publication']===$infoResult['publication'],'metadata-only save is idempotent');
check(!ncd_row($db,$infoId,$owner)['document']['_creative']['needsReview'],'acknowledged fields clear after successful save');

// Unclassified cover and audio share 기타, then move together through the existing writer.
$moveId='abcdef1234567890abcdef1234567890';$move=ncd_create($db,$owner,$moveId,'저장 위치 이동 검증');
$move=ncd_save($db,$owner,['id'=>$moveId,'revision'=>$move['revision'],'fields'=>['title'=>'같은 이름의 곡']]);
$move=ncd_cover($db,$owner,['id'=>$moveId,'revision'=>$move['revision']],file_get_contents(__DIR__.'/fixture.webp'));
$ma=nj_find($db,$move['doc_key']);check(str_starts_with($ma['cover_path'],'기타/'),'unselected default category does not classify media');
$audio=dirname($ma['cover_path']).'/song.mp3';copy(__DIR__.'/fixture.mp3',nj_private().'/media/'.$audio);
$db->prepare("UPDATE noa_jukebox_assets SET audio_path=?,audio_bytes=?,audio_sha256=?,status='ready' WHERE song_key=?")->execute([$audio,filesize(__DIR__.'/fixture.mp3'),hash_file('sha256',__DIR__.'/fixture.mp3'),$move['doc_key']]);
$oldPaths=[$audio,$ma['cover_path']];$move=ncd_save($db,$owner,['id'=>$moveId,'revision'=>$move['revision'],'location'=>['genre'=>'your-story','collections'=>[]]]);$ma=nj_find($db,$move['doc_key']);
check(str_starts_with($ma['audio_path'],'사연곡/')&&dirname($ma['audio_path'])===dirname($ma['cover_path']),'classification moves both files to one folder');
check(str_contains($ma['audio_path'],'사연곡/같은 이름의 곡 ['),'folder uses the accepted song title');
$blankAlias=$move['document'];$blankAlias['body']['displayTitle']='';$blankAlias['body']['confirmedTitle']='';$blankAlias['title']='행간의 연서(行間戀書)';check(str_contains(nml_directory($move['doc_key'],$blankAlias),'사연곡/행간의 연서(行間戀書) ['),'empty aliases cannot hide the current document title');
check(nj_verified($ma,'audio')&&nj_verified($ma,'cover'),'both media hashes and formats preserved');
check($move['document']['body']['audioFileLocation']===$ma['audio_path']&&$move['document']['body']['cardImageLocation']===$ma['cover_path'],'current record has current paths');
nml_cleanup($db);foreach($oldPaths as $old)check(nj_file($old)===null,'unreferenced old path removed after commit');
// An in-flight upload cannot race a classification change.
$busyId='55555555555555555555555555555555';$db->prepare('INSERT INTO noa_jukebox_uploads(id,song_key,source_url,filename,extension,file_bytes,fingerprint,total_chunks,status,context,requested_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)')->execute([$busyId,$move['doc_key'],'','busy.mp3','mp3',filesize(__DIR__.'/fixture.mp3'),str_repeat('5',64),1,'processing','{}',$owner]);
$moveRevision=$move['revision'];denied(fn()=>ncd_save($db,$owner,['id'=>$moveId,'revision'=>$moveRevision,'location'=>['genre'=>'kpop-original','ep'=>'88','collections'=>[]]]),'upload_busy');
check(ncd_row($db,$moveId,$owner)['revision']===$moveRevision&&nj_find($db,$move['doc_key'])['audio_path']===$ma['audio_path'],'active upload leaves record and paths unchanged');
$db->prepare("UPDATE noa_jukebox_uploads SET status='ready' WHERE id=?")->execute([$busyId]);
// A SQL rollback preserves old media and removes only this operation\'s unused links.
$rollbackDoc=$move['document'];$rollbackDoc['_creative']['locationConfirmed']=false;$db->beginTransaction();$rolled=nml_sync($db,$move['doc_key'],$rollbackDoc);$db->rollBack();nml_cleanup($db);
check(nj_find($db,$move['doc_key'])['audio_path']===$ma['audio_path']&&nj_verified($ma,'audio'),'rollback preserves committed playable media');check(nj_file($rolled['body']['audioFileLocation'])===null,'rollback cleans unused target');
// General song classification updates use the same owner, with no new worker.
$db->beginTransaction();$classified=nj_document($db,$infoKey);$db->prepare('INSERT INTO noa_jukebox_assets(song_key,source_url,audio_path,audio_bytes,audio_sha256,cover_path,cover_bytes,cover_sha256,status) SELECT ?,source_url,audio_path,audio_bytes,audio_sha256,cover_path,cover_bytes,cover_sha256,status FROM noa_jukebox_assets WHERE song_key=?')->execute([$infoKey,$move['doc_key']]);
$classified['genreId']='unclassified';nup_store($db,$infoKey,'story',$classified,1,$owner);$db->commit();$unclassified=nj_find($db,$infoKey);check(str_starts_with($unclassified['audio_path'],'기타/'),'unclassified existing song uses 기타');
$db->beginTransaction();$classified=nj_document($db,$infoKey);$classified['genreId']='pop-original';nup_store($db,$infoKey,'story',$classified,2,$owner);$db->commit();nml_cleanup($db);$classified=nj_find($db,$infoKey);
check(str_starts_with($classified['audio_path'],'POP/')&&dirname($classified['audio_path'])===dirname($classified['cover_path']),'later genre change moves audio and artwork');
check(nj_verified(nj_find($db,$move['doc_key']),'audio'),'another record sharing source bytes stays playable');
echo "CREATIVE_FINAL_ACK_NO_MEDIA_CATEGORY_SAVE_MEDIA_LOCATION_ATOMIC_OK\n";

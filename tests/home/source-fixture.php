<?php
/** Add explicit synthetic owner-list membership to the source catalog fixture. */
declare(strict_types=1);
require __DIR__.'/../popularity/source_fixture.php';
$run=ny_latest($db);$songs=ny_songs($db,ny_batch($db));
$originals=array_filter($songs,fn($s)=>str_ends_with($s['genre_id'],'-original'));
if(!$originals)throw new RuntimeException('source_original_song_required');
$sid=array_key_first($originals);
$insertList=$db->prepare('INSERT INTO noa_youtube_playlists(run_id,playlist_id,payload) VALUES(?,?,?)');
$insertVideo=$db->prepare('INSERT INTO noa_youtube_videos(run_id,video_id,payload,match_json) VALUES(?,?,?,?)');
$insertItem=$db->prepare('INSERT INTO noa_youtube_items(run_id,playlist_id,item_id,position,video_id,payload) VALUES(?,?,?,?,?,?)');
$insertCategory=$db->prepare("INSERT INTO noa_content_categories(content_type,content_id,category_id,source,evidence,updated_by) VALUES('video',?,?,'manual',?,'home-fixture')");
foreach([
 ['stories','PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB','당신의 이야기, 우리의 음악','your-story','hmst'],
 ['covers','PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb','AInoa의 유명곡 커버','cover-reborn','hmcv'],
]as [$section,$playlist,$title,$category,$prefix]){
 $insertList->execute([$run['run_id'],$playlist,np_json(['id'=>$playlist,'snippet'=>['title'=>$title,'channelId'=>NP_CHANNEL],'status'=>['privacyStatus'=>'public']])]);
 for($i=0;$i<12;$i++){
  $video=sprintf($prefix.'%07d',$i+1);$payload=['id'=>$video,'snippet'=>['title'=>'Isolated '.$section.' fixture '.($i+1),'channelId'=>NP_CHANNEL],'status'=>['privacyStatus'=>'public','embeddable'=>true],'statistics'=>['viewCount'=>(string)(5000-$i)]];
  $insertVideo->execute([$run['run_id'],$video,np_json($payload),np_json(['songId'=>$sid,'status'=>'matched','candidates'=>[]])]);
  $insertItem->execute([$run['run_id'],$playlist,$section.'-'.$i,$i,$video,np_json(['videoId'=>$video])]);
  $insertCategory->execute([$video,$category,np_json(['fixture'=>'explicit synthetic owner list'])]);
 }
}
@mkdir('quality-home',0700,true);
$provenance=json_decode(file_get_contents('quality-popularity/fixture-provenance.json'),true,512,JSON_THROW_ON_ERROR);
$provenance['homeOwnerListFixtureVideos']=24;$provenance['homeThumbnailKind']='isolated SVG placeholder; actual public thumbnails checked separately';
file_put_contents('quality-home/fixture-provenance.json',json_encode($provenance,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "NOA_HOME_DISPOSABLE_SOURCE_FIXTURE_READY\n";

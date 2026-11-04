<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
$root=dirname(__DIR__,2);
require $root.'/bridge/storage.php';
require $root.'/deploy/noa-app/engine/personal-song-index.php';
require $root.'/bridge/listening-video-catalog.php';
function expectIndex(bool $ok,string $description):void{if(!$ok)throw new RuntimeException($description);}
$db=noa_bridge_pdo();
$docs=['one'=>['title'=>'위로','lyrics'=>'[Verse] 혼자가 아니야'],'two'=>['title'=>'드라이브','lyrics'=>'road trip']];
$scan=static function(callable $visit)use(&$docs){foreach($docs as $key=>$d)$visit(['key'=>$key,'title'=>$d['title'],'orderKey'=>$key],['lyricsBlock'=>$d['lyrics']],[]);};
$first=n80_refresh_song_index($db,$scan);
expectIndex($first['analyzed']===2&&$first['written']===2,'cold index');
$repeat=n80_refresh_song_index($db,$scan);
expectIndex($repeat['analyzed']===0&&$repeat['written']===0&&$repeat['reused']===2,'warm index');
$docs['one']['title']='집중';$docs['one']['lyrics']='생각을 정리';$changed=n80_refresh_song_index($db,$scan);
expectIndex($changed['analyzed']===1&&$changed['reused']===1,'only edited recording analyzed');
expectIndex(n80_song_features($db)['one']['moodScores']['focus']>0,'edited score');
unset($docs['two']);expectIndex(n80_refresh_song_index($db,$scan)['removed']===1,'retired song removed from derived index');
$base=['kind'=>'video','title'=>'테스트','genre'=>'your-story','ep'=>'','act'=>'','registeredAt'=>1,'canonicalVideo'=>null,'audio'=>'premium.example/private.mp3'];
$songs=[];$videos=[];
foreach(['public','private','unlisted','noembed','rejected','conflict','unknown','album','unlinked'] as $i=>$name){
 $id='v'.str_pad((string)$i,10,'0',STR_PAD_LEFT);
 if($name!=='unlinked')$songs[$name]=['key'=>$name]+$base;
 $videos[$id]=['id'=>$id,'status'=>['privacyStatus'=>in_array($name,['private','unlisted'])?$name:'public','embeddable'=>$name!=='noembed'],'match'=>['songId'=>$name,'status'=>in_array($name,['rejected','conflict'])?$name:'matched']];
 if($name==='unknown')$videos[$id]['legacy']=true;
 if($name==='album')$songs[$name]['kind']='playlist';
}
$videos['v0000000009']=$videos['v0000000000'];$songs['public']['canonicalVideo']='v0000000009';
$r=n80_public_listening_videos($songs,$videos,['public'=>['moodScores'=>['calm'=>3],'moodAffinity'=>[]]]);
expectIndex(count($r)===1&&$r[0]['publicVideoId']==='v0000000009'&&$r[0]['moodScores']['calm']===3,'verified preferred public video only');
expectIndex(!isset($r[0]['audio'],$r[0]['keywords'])&&!str_contains(json_encode($r),'private.mp3'),'safe public fields');
echo "N80_SONG_INDEX_REUSE_EDIT_REMOVAL_PUBLIC_VIDEO_OK\n";

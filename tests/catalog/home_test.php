<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/home-core.php';
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$channel='owner';$songs=['a'=>['genre_id'=>'kpop-original','ep'=>1],'b'=>['genre_id'=>'your-story','ep'=>2],'c'=>['genre_id'=>'cover-reborn','ep'=>3]];
function video($id,$song,$views,$privacy='public',$owner='owner') {return ['id'=>$id,'snippet'=>['title'=>'Same title','channelId'=>$owner],'status'=>['privacyStatus'=>$privacy,'embeddable'=>true],'match'=>['songId'=>$song,'status'=>'matched'],'statistics'=>['viewCount'=>$views]];}
$videos=[video('aaaaaaaaaaa','a','12'),video('bbbbbbbbbbb','a','120'),video('ccccccccccc','b','50'),video('ddddddddddd','c','0'),video('private0000','a','99999','private'),video('unknown0000',null,'88888'),video('outside0000','a','77777','public','other'),video('missing0000','a',null)];
$list=['id'=>'PLcontinuous1','snippet'=>['title'=>'연속듣기 Continuous Listening','channelId'=>$channel],'status'=>['privacyStatus'=>'public']];
$r=nh_build($videos,$songs,[$list],['PLcontinuous1'=>['aaaaaaaaaaa','bbbbbbbbbbb','aaaaaaaaaaa','private0000','unknown0000']],$channel);
check(array_column($r['featured'],'videoId')===['bbbbbbbbbbb','ccccccccccc','aaaaaaaaaaa','ddddddddddd'],'ranking leaked private/unmatched/external videos or sorted strings lexically');
check($r['ep'][0]['videoId']==='bbbbbbbbbbb','genre winner incorrect');check(count($r['stories'])===1&&count($r['covers'])===1,'genre filtering/zero views');check($r['counts']['linkedPublicVideosWithoutViewCount']===1,'missing views treated as zero');
check($r['playlists'][0]['score']===89020&&$r['playlists'][0]['countedVideos']===3&&$r['playlists'][0]['excludedVideos']===1,'playlist must include unlinked compilation, dedup repeats and exclude private members');$list['snippet']['title']='연속 듣기';check(count(nh_build($videos,$songs,[$list],['PLcontinuous1'=>['unknown0000']],$channel)['playlists'])===1,'spaced label or compilation member excluded');check(str_contains($r['playlistBasis'],'공식 재생목록 조회수가 아닙니다'),'aggregate mislabeled');check(str_ends_with($r['featured'][0]['href'],'&play=1'),'explicit selection route');
$list['status']['privacyStatus']='private';check(nh_build($videos,$songs,[$list],[], $channel)['playlists']===[],'private playlist exposed');
check(nh_views('9223372036854775808')===null&&nh_views('-1')===null&&nh_views('1.5')===null&&nh_views('0')===0,'invalid numeric views');
$many=[];for($i=0;$i<20;$i++)$many[]=video(str_pad((string)$i,11,'0',STR_PAD_LEFT),'a',(string)$i);$a=nh_build($many,$songs,[],[],$channel);check(count($a['featured'])===10&&$a['featured'][0]['views']===19,'top ten limit');
echo "PASS home privacy, identity, ranking, genre winner, missing metrics and distinct playlist aggregation\n";


$story=video('story000001',null,'400');$story['snippet']['title']='두 개의 숟가락 | 사연곡';
$cover=video('cover000001',null,'900');$cover['snippet']['title']='서쪽 하늘 | Cover by AInoa';
$translation=video('trans000001',null,'9999');$translation['snippet']['title']='[Cover] EP.2 POP Original J-POP Ver.';
$act=video('act00000001',null,'300');$act['snippet']['title']='ACT.1 Playlist | EP.1-10';
$member=video('member00001',null,'500');$member['snippet']['title']='분류는 제목이 아니라 소속 목록에만 있음';
$noMetric=$story;$noMetric['id']='noMetric001';$noMetric['statistics']=[];
$rejected=$cover;$rejected['id']='reject00001';$rejected['match']['status']='rejected';
$ownerList=['id'=>'PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB','snippet'=>['title'=>'당신의 이야기, 우리의 음악 🎧','channelId'=>$channel],'status'=>['privacyStatus'=>'public']];
$x=nh_build([$story,$cover,$translation,$act,$member,$noMetric,$rejected],[],[$ownerList],[$ownerList['id']=>['member00001']],$channel);
check(array_column($x['stories'],'videoId')===['member00001','story000001'],'owner playlist membership and explicit story labels must recover unlinked records');
check(array_column($x['covers'],'videoId')===['cover000001'],'generic Cover translation or rejected match leaked into famous covers');
check($x['stories'][0]['songId']===null&&$x['stories'][0]['classificationSource']==='owner_playlist_membership','category recovery invented song identity');
check($x['playlists'][0]['contentType']==='video'&&$x['playlists'][0]['scoreKind']==='video_view_count'&&!isset($x['playlists'][0]['playlistId']),'compilation confused with official playlist');
check($x['diagnostics']['stories']['reasons']['missing_view_count']===1,'missing metrics not explained');
check(nh_build([],[],[],[],$channel)['diagnostics']['stories']['emptyReason']==='no_registered_or_collected_data','empty registration not distinguished');
$conflict=$cover;$conflict['snippet']['title'].=' 사연곡';$c=nh_build([$conflict],[],[],[],$channel);check(!$c['covers']&&!$c['stories']&&$c['diagnostics']['covers']['reasons']['classification_conflict']===1,'ambiguous category not held out');
$dupes=nh_build([$story,$story],[],[],[],$channel);check(count($dupes['stories'])===1,'duplicate video ranked twice');
echo "PASS recovered category provenance, missing metrics, rejected/ambiguous identity, translated originals, compilation types and deduplication\n";

$registeredOnly=nh_build([],$songs,[],[],$channel);check($registeredOnly['diagnostics']['stories']['emptyReason']==='catalog_video_mapping_missing'&&$registeredOnly['diagnostics']['stories']['catalogSongsWithoutCollectedVideo']===1,'registered song with missing video relationship must be distinct from no data');
echo "PASS registered-but-unmapped versus absent data diagnostics\n";

$sqlOverride=video('sqlgenre001','b','99');$sqlOverride['snippet']['title']='사연곡';$sqlOverride['sqlCategories']=['cover-reborn'];$sqlOverride['sqlClassificationReady']=true;$s=nh_build([$sqlOverride],$songs,[],[],$channel);check(count($s['covers'])===1&&!$s['stories'],'SQL classification must precede legacy genre and title fallback');$sqlOverride['sqlCategories']=[];$s=nh_build([$sqlOverride],$songs,[],[],$channel);check(!$s['covers']&&!$s['stories'],'completed SQL classification must not resurrect disabled legacy categories');
echo "PASS SQL category authority over legacy genre/title after initial classification\n";

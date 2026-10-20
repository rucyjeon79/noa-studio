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
check($r['playlists'][0]['score']===132&&$r['playlists'][0]['countedVideos']===2&&$r['playlists'][0]['excludedVideos']===2,'duplicate, private or unknown membership overcounted');check(str_contains($r['playlistBasis'],'공식 재생목록 조회수가 아닙니다'),'aggregate mislabeled');check(str_ends_with($r['featured'][0]['href'],'&play=1'),'explicit selection route');
$list['status']['privacyStatus']='private';check(nh_build($videos,$songs,[$list],[], $channel)['playlists']===[],'private playlist exposed');
check(nh_views('9223372036854775808')===null&&nh_views('-1')===null&&nh_views('1.5')===null&&nh_views('0')===0,'invalid numeric views');
$many=[];for($i=0;$i<20;$i++)$many[]=video(str_pad((string)$i,11,'0',STR_PAD_LEFT),'a',(string)$i);$a=nh_build($many,$songs,[],[],$channel);check(count($a['featured'])===10&&$a['featured'][0]['views']===19,'top ten limit');
echo "PASS home privacy, identity, ranking, genre winner, missing metrics and distinct playlist aggregation\n";

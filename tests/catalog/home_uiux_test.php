<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/home-core.php';
function demand(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
$pid='PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB';$videos=[];$songs=[];$members=[];
foreach(['kpop-original','your-story','cover-reborn'] as $g=>$genre)for($i=0;$i<30;$i++){
 $id=sprintf('%011d',$g*100+$i);$sid='s'.$id;$songs[$sid]=['genre_id'=>$genre,'ep'=>$i+1];
 $videos[]=['id'=>$id,'snippet'=>['title'=>'Track '.$i,'channelId'=>'owner'],'status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['songId'=>$sid,'status'=>'matched'],'statistics'=>['viewCount'=>(string)(1000-$i-$g*10)]];
 if($g===1&&$i!==0)$members[]=$id;
}
$list=['id'=>$pid,'snippet'=>['title'=>'당신의 이야기, 우리의 음악','channelId'=>'owner'],'status'=>['privacyStatus'=>'public']];
$r=nh_build($videos,$songs,[$list],[$pid=>$members],'owner');$featured=array_column($r['featured'],'videoId');
foreach(['ep','stories','covers'] as $section){$ids=array_column($r[$section],'videoId');demand(count($ids)===10,$section.' did not refill to ten');demand(!array_intersect($ids,$featured),$section.' repeated a featured ID');demand(count($ids)===count(array_unique($ids)),'duplicate '.$section);}
demand(!in_array('00000000100',array_column($r['stories'],'videoId'),true),'canonical genre admitted a nonmember');
foreach($r['stories'] as $row)demand(in_array($row['videoId'],$members,true),'story outside official membership');
$empty=nh_build($videos,$songs,[],[],'owner');demand(!$empty['stories'],'missing official membership must fail closed');
echo "PASS refill ten after featured exclusion, EP limit, official story membership and missing-list fail-closed\n";

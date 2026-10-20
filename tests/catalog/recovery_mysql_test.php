<?php
declare(strict_types=1);define('_GNUBOARD_',true);require __DIR__.'/../../bridge/catalog-recovery.php';
$db=new PDO(getenv('NOA_TEST_MYSQL_DSN'),'root','noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);function rc(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
$base=ny_batch($db);$run=ny_latest($db);$before=ny_songs($db,$base);$guard=nc_guard($db);$oldFields=array_column($before,'fields_json','song_id');
// A source-only import may start before a newer recovery is published.
$olderImport=nc_prepare($db);$olderImport['digest']=nc_hash(['concurrent-import-fixture',$olderImport['digest']]);nc_apply($db,$olderImport,'start',0,'test');
$v=['id'=>'recovery001','snippet'=>['title'=>'Fixture | Cover by AInoa','categoryId'=>'10','description'=>'','channelId'=>$run['channel_id']],'contentDetails'=>['duration'=>'PT3M'],'status'=>['privacyStatus'=>'private']];$e=nr_entity($v,$run['channel_id']);$pid=nc_hash(['recovery-fixture-list']);
$p=['base'=>$base,'run'=>$run['run_id'],'sourceGuard'=>$guard,'counts'=>['registeredBefore'=>count($before),'newSongs'=>1,'supplementSongs'=>0],'new'=>[$e['id']=>$e],'patch'=>[],'review'=>['ambiguous'=>'held'],'playlists'=>[$pid=>['title'=>'Fixture ordered list']],'relations'=>[['playlist'=>$pid,'position'=>8,'song'=>$e['id'],'raw'=>['youtubePosition'=>7]]]];$p['id']=nc_hash($p);$result=nr_apply($db,$p,'test');rc($result['report']['registeredAfter']===count($before)+1,'not published');rc(nr_apply($db,$p,'test')['replayed']===true,'replay duplicated');rc(nc_guard($db)===$guard,'original data changed');rc(array_column(ny_songs($db,$base),'fields_json','song_id')===$oldFields,'previous edition overwritten');$songs=ny_songs($db,ny_batch($db));rc((int)$songs[$e['id']]['public_verified']===0,'private record exposed');$q=$db->prepare('SELECT position,raw_json FROM noa_catalog_tracks WHERE batch_id=? AND playlist_id=?');$q->execute([$p['id'],$pid]);$row=$q->fetch(PDO::FETCH_ASSOC);rc((int)$row['position']===8&&json_decode($row['raw_json'],true)['youtubePosition']===7,'playlist source order changed');
$p2=$p;$p2['base']=ny_batch($db);$p2['new']=[];$p2['patch']=[];$p2['counts']['registeredBefore']=count($songs);$p2['id']=nc_hash($p2);rc(nr_apply($db,$p2,'test')['report']['noChangesRequired'],'no-op made another edition');
echo "Recovery MySQL: new regular song, immutable previous edition, source guard, private visibility, ordered playlist membership, replay and no-op passed.\n";

foreach(['start','verify'] as $stage){
 try{nc_apply($db,$olderImport,$stage,0,'test');throw new RuntimeException('older import hid recovered records');}
 catch(DomainException $e){rc($e->getMessage()==='published_catalog_would_lose_records','wrong retention rejection');}
 rc(ny_batch($db)===$p['id'],'recovery no longer latest');
 rc(isset(ny_songs($db,ny_batch($db))[$p['new'][array_key_first($p['new'])]['id']]),'recovered song disappeared');
 rc($db->query("SELECT IS_USED_LOCK('noa_catalog_publication')")->fetchColumn()===null,'publication lock leaked');
}
echo "Recovery retention: older source import blocked at start and final publication; latest recovery retained; shared lock released.\n";

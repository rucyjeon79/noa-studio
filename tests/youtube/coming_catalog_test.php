<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/youtube-catalog.php';
function ny_video_id(string $url):?string{parse_str((string)parse_url($url,PHP_URL_QUERY),$q);return isset($q['v'])&&preg_match('/^[A-Za-z0-9_-]{11}$/D',$q['v'])?$q['v']:null;}
function check(bool $v,string $m):void{if(!$v)throw new RuntimeException($m);}
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE noa_documents(doc_key TEXT,kind TEXT,payload TEXT);CREATE TABLE noa_catalog_aliases(batch_id TEXT,alias_key TEXT,entity_id TEXT);CREATE TABLE noa_catalog_batches(batch_id TEXT,status TEXT,applied_at TEXT);CREATE TABLE noa_catalog_songs(song_id TEXT,identity_json TEXT,genre_id TEXT,ep TEXT);CREATE TABLE noa_catalog_versions(batch_id TEXT,entity_id TEXT,entity_type TEXT,fields_json TEXT,public_verified INT);INSERT INTO noa_catalog_batches VALUES('b','applied','2026-10-25');");
$a=str_repeat('a',64);$b=str_repeat('b',64);$c=str_repeat('c',64);
$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');$doc=['title'=>'원래 제목','genreId'=>'kpop-original','ep'=>'1','body'=>['confirmedTitle'=>'확정 제목','youtubeUrl'=>'https://www.youtube.com/watch?v=private0001']];$q->execute(['song:a','single',json_encode($doc)]);
$db->prepare('INSERT INTO noa_catalog_aliases VALUES(?,?,?)')->execute(['b','song:a',$a]);
$q->execute(['song:hidden','single',json_encode(['title'=>'EDITORIAL_SECRET','visibility'=>'private','genreId'=>'kpop-original','body'=>[]])]);
$db->prepare('INSERT INTO noa_catalog_songs VALUES(?,?,?,?)')->execute([$b,'[]','jpop-original','2']);$db->prepare('INSERT INTO noa_catalog_versions VALUES(?,?,?,?,?)')->execute(['b',$b,'song',json_encode(['title'=>'새로 등록한 곡']),1]);

$catalog=ny_listener_catalog($db,false);check(count($catalog)===2,'same visible MUSIC registry');check($catalog[$a]['title']==='확정 제목','confirmed song title');check(!isset($catalog['song:hidden']),'explicit editorial privacy retained');
$public=[['key'=>'short000001','orderKey'=>$a,'title'=>'공개 Shorts','genre'=>'kpop-original','ep'=>'1','kind'=>'video','video'=>'short000001','preferredVideo'=>false]];
$videos=['short000001'=>['status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['songId'=>$a]],'private0001'=>['status'=>['privacyStatus'=>'private','embeddable'=>false],'match'=>['songId'=>$a],'snippet'=>['title'=>'PROVIDER_PRIVATE_TITLE','description'=>'PRIVATE_DESCRIPTION']]];
$rows=ny_complete_catalog_rows($public,$videos,$catalog);$pending=array_values(array_filter($rows,fn($r)=>!empty($r['comingSoon'])));check(count($pending)===2,'private canonical plus registered song without a video');check($rows[0]===$public[0],'existing public source preserved');
foreach($pending as $r){check($r['video']==='','no playable private ID');check($r['musicKey']===$catalog[$r['orderKey']]['key'],'same canonical song source');check($r['preferredVideo']===true,'canonical full video wins over public alternate');check(str_starts_with($r['thumb'],'/noa-assets/coming/'),'genre Coming soon art');}
$encoded=json_encode($rows);foreach(['PRIVATE_DESCRIPTION','PROVIDER_PRIVATE_TITLE','private0001','EDITORIAL_SECRET'] as $secret)check(!str_contains($encoded,$secret),'metadata-only preview: '.$secret);
$videos['private0001']['status']=['privacyStatus'=>'public','embeddable'=>true];$public[]=['key'=>'private0001','orderKey'=>$a,'title'=>'공개된 원곡','genre'=>'kpop-original','ep'=>'1','kind'=>'video','video'=>'private0001','preferredVideo'=>true];$after=ny_complete_catalog_rows($public,$videos,$catalog);check(count(array_filter($after,fn($r)=>!empty($r['comingSoon'])))===1,'publication automatically replaces placeholder');
$genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];foreach($genres as $g){$art=ny_coming_art($g);check(str_contains($art['thumb'],$g),'genre-specific art: '.$g);}
check((int)$db->query('SELECT COUNT(*) FROM noa_documents')->fetchColumn()===2,'no document writes');echo "COMING_CATALOG_PARITY_PRIVATE_METADATA_AND_PUBLICATION_OK\n";

$act=['key'=>'playlist:kpop:1','orderKey'=>'playlist:kpop:1','title'=>'ACT 1','genre'=>'kpop-original','ep'=>'','act'=>'1','kind'=>'playlist','canonicalVideo'=>'actvideo001'];
$actRows=ny_complete_catalog_rows([['key'=>'actvideo001','orderKey'=>'youtube:actvideo001','video'=>'actvideo001','kind'=>'video','title'=>'업로드 제목']],['actvideo001'=>['status'=>['privacyStatus'=>'public','embeddable'=>true]]],['playlist:kpop:1'=>$act]);
check(count($actRows)===1&&$actRows[0]['kind']==='playlist'&&$actRows[0]['act']==='1'&&$actRows[0]['musicKey']==='playlist:kpop:1','ACT URL links its playable public video');

$sharedSong=['key'=>'song:shared','orderKey'=>'song:shared','title'=>'곡','genre'=>'kpop-original','ep'=>'1','act'=>'1','kind'=>'video','canonicalVideo'=>'actvideo001'];
$source=['actvideo001'=>['status'=>['privacyStatus'=>'public','embeddable'=>true],'match'=>['songId'=>'song:shared','status'=>'approved']]];
$shared=ny_complete_catalog_rows([['key'=>'actvideo001','orderKey'=>'song:shared','video'=>'actvideo001','kind'=>'video','title'=>'곡']],$source,['song:shared'=>$sharedSong,'playlist:kpop:1'=>$act]);
check(count($shared)===2&&$shared[1]['kind']==='playlist'&&$shared[1]['video']==='actvideo001'&&empty($shared[1]['comingSoon']),'ACT remains playable when the same video also has a song mapping');
check(array_keys(ny_act_public_sources($source,[$act]))===['actvideo001'],'linked public ACT source retained');
$source['actvideo001']['status']['privacyStatus']='private';check(ny_act_public_sources($source,[$act])===[],'private ACT never restored');
$source['actvideo001']['status']['privacyStatus']='public';$source['actvideo001']['match']['status']='rejected';check(ny_act_public_sources($source,[$act])===[],'explicit rejection remains authoritative');
echo "ACT_PUBLIC_URL_SONG_ALIAS_AND_PRIVATE_BOUNDARIES_OK\n";

// Custom story/cover collections use the same verified source as ACT collections.
$customId='111111111111111111111111';$customKey='playlist:custom:'.$customId;
$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)')->execute([$customKey,'playlist',json_encode(['customPlaylistId'=>$customId,'title'=>'커버 모음','genreId'=>'cover-reborn','body'=>['youtubeUrl'=>'https://www.youtube.com/watch?v=custom00001']])]);
$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)')->execute(['playlist:custom:222222222222222222222222','playlist',json_encode(['customPlaylistId'=>'222222222222222222222222','title'=>'URL 없는 모음','genreId'=>'your-story','body'=>[]])]);
$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)')->execute(['playlist:custom:333333333333333333333333','playlist',json_encode(['customPlaylistId'=>'333333333333333333333333','title'=>'PRIVATE_CUSTOM_TITLE','visibility'=>'private','genreId'=>'cover-reborn','body'=>['youtubeUrl'=>'https://www.youtube.com/watch?v=secret00001']])]);
$registry=ny_listener_catalog($db,false);check(isset($registry[$customKey]),'custom collection with URL participates in YouTube read model');check($registry[$customKey]['customPlaylistId']===$customId,'stable custom collection identity');check(!isset($registry['playlist:custom:222222222222222222222222']),'URL-less collection remains list-only');check(!isset($registry['playlist:custom:333333333333333333333333']),'private collection remains private');
$customSource=['custom00001'=>['status'=>['privacyStatus'=>'public','embeddable'=>true]]];$customSources=ny_act_public_sources($customSource,$registry);check(isset($customSources['custom00001']),'public custom video available to raw native player');
$customRows=ny_complete_catalog_rows([['key'=>'custom00001','orderKey'=>'','title'=>'YouTube title','genre'=>'unclassified','kind'=>'video','video'=>'custom00001']],$customSource,[$customKey=>$registry[$customKey]]);check(count($customRows)===1&&$customRows[0]['customPlaylistId']===$customId&&$customRows[0]['genre']==='cover-reborn'&&$customRows[0]['musicKey']===$customKey,'public source projected as correct custom collection');
$customSource['custom00001']['status']['privacyStatus']='private';check(ny_act_public_sources($customSource,$registry)===[],'private custom video never restored');$pending=ny_complete_catalog_rows([],$customSource,[$customKey=>$registry[$customKey]]);check(count($pending)===1&&$pending[0]['comingSoon']&&$pending[0]['video']===''&&!str_contains(json_encode($pending),'custom00001'),'private custom URL not exposed in preview');
$customSource['custom00001']['status']['privacyStatus']='public';$customSource['custom00001']['match']['status']='rejected';check(ny_act_public_sources($customSource,$registry)===[],'rejected custom mapping never restored');
echo "CUSTOM_PLAYLIST_PUBLIC_SOURCE_PRIVATE_BOUNDARY_AND_URLLESS_FALLBACK_OK\n";

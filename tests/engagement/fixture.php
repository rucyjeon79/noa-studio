<?php
/** Disposable MySQL/site only; never deployed. */
passthru('php '.escapeshellarg(__DIR__.'/../community/fixture.php'),$status);if($status!==0)exit($status);
$root='/tmp/noa-community-fixture';
$extra= <<<'PHP'

// Match native bootstrap escaping, which previously broke JSON batch queries.
$_GET=array_map(static fn($v)=>is_string($v)?addslashes($v):$v,$_GET);
$g5['member_table']='g5_member';$g5['board_good_table']='g5_board_good';
putenv('NOA_MYSQL_DSN=mysql:host=127.0.0.1;dbname=noa_community;charset=utf8mb4');putenv('NOA_MYSQL_USER=root');putenv('NOA_MYSQL_PASSWORD=fixture-only');
if(($_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8077')$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';
PHP;
file_put_contents($root.'/common.php',$extra,FILE_APPEND);
require $root.'/common.php';
foreach(glob('bridge/*.php')as $file)if(!is_file($root.'/noa-bridge/'.basename($file)))copy($file,$root.'/noa-bridge/'.basename($file));
foreach(['engagement-core.php','engagement-targets.php','engagement.php','popularity-core.php','popularity-store.php']as $file)copy('bridge/'.$file,$root.'/noa-bridge/'.$file);
foreach(['noa-engagement.js','noa-engagement.css']as $file)copy('deploy/'.$file,$root.'/'.$file);
require 'bridge/engagement-targets.php';$db=new PDO('mysql:host=127.0.0.1;dbname=noa_community;charset=utf8mb4','root','fixture-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE g5_member (mb_id VARCHAR(191) PRIMARY KEY,mb_nick VARCHAR(255))');$db->exec("INSERT INTO g5_member VALUES ('qa_a','별무리 A'),('qa_b','별무리 B'),('qa_temp','새 회원'),('qa_admin','관리자')");
$db->exec('CREATE TABLE g5_board_good (bo_table VARCHAR(20),wr_id INT,mb_id VARCHAR(191),bg_flag VARCHAR(10))');$db->exec("INSERT INTO g5_board_good VALUES ('free',1,'qa_b','good')");
$db->exec('CREATE TABLE noa_documents (doc_key VARCHAR(191) PRIMARY KEY,kind VARCHAR(30),payload JSON)');
foreach(require 'bridge/catalog-schema.php' as $sql)$db->exec($sql);ny_schema($db);$batch=str_repeat('f',64);$song=str_repeat('a',64);$private=str_repeat('b',64);
$db->prepare("INSERT INTO noa_catalog_batches (batch_id,status,report,source_guard,created_by,applied_at) VALUES (?,'applied','{}',?,'fixture',NOW())")->execute([$batch,$batch]);
foreach([$song,$private]as $sid){$db->prepare("INSERT INTO noa_catalog_songs VALUES (?,'[\"song\",\"fixture\",\"test\",\"1\"]','kpop-original','ko','',1)")->execute([$sid]);$fields=json_encode(['title'=>$sid===$song?'검증 음악':'비공개 음악','visibility'=>$sid===$song?'public':'private']);$db->prepare("INSERT INTO noa_catalog_versions VALUES (?,?,'song',?,?,'[]',1)")->execute([$batch,$sid,$fields,hash('sha256',$fields)]);}
$db->prepare('INSERT INTO noa_catalog_aliases VALUES (?,?,?)')->execute([$batch,'fixture-song',$song]);
$db->prepare("INSERT INTO noa_documents VALUES ('fixture-song','single',?)")->execute([json_encode(['title'=>'검증 음악','visibility'=>'public'])]);
$run=str_repeat('c',32);$db->prepare('INSERT INTO noa_youtube_runs(run_id,channel_id,catalog_batch,report) VALUES (?,?,?,?)')->execute([$run,'UCwYy9xsAqDFat6AV5UKrfgA',$batch,'{}']);
$video=['id'=>'abcdefghijk','snippet'=>['channelId'=>'UCwYy9xsAqDFat6AV5UKrfgA','title'=>'공개 음악 영상'],'status'=>['privacyStatus'=>'public','embeddable'=>true],'statistics'=>['viewCount'=>'10']];$db->prepare('INSERT INTO noa_youtube_videos VALUES (?,?,?,?)')->execute([$run,$video['id'],json_encode($video),json_encode(['songId'=>$song,'status'=>'matched'])]);
$before=$db->query('SELECT COUNT(*) FROM g5_write_free')->fetchColumn();$created=ne_install($db);if(count($created)!==3||ne_install($db)!==[]||$before!==$db->query('SELECT COUNT(*) FROM g5_write_free')->fetchColumn())throw new RuntimeException('additive_install');
$g5['member_table']='g5_member';$g5['board_good_table']='g5_board_good';$member=['mb_id'=>'qa_a','mb_level'=>4];$is_admin='';
function ne_check($v,$label){if(!$v)throw new RuntimeException($label);}
$a=ne_target($db,'music','fixture-song');$b=ne_target($db,'music','catalog:'.$song);ne_check($a['entity']===$b['entity'],'canonical alias');
foreach([['music','catalog:'.$private],['board','free:7'],['board','song_request:1'],['board','certonly:1'],['board','grouponly:1'],['board','staffonly:1'],['video','missingxxxx']]as [$type,$id]){try{ne_target($db,$type,$id);throw new RuntimeException('access leak '.$id);}catch(DomainException $expected){}}
ne_like($db,$a['entity'],'qa_a',true,false,100);ne_like($db,$a['entity'],'qa_a',true,false,101);ne_check((int)$db->query('SELECT COUNT(*) FROM noa_post_like_events')->fetchColumn()===1,'like replay');
$id=ne_comment($db,$a['entity'],'qa_a','11111111-1111-4111-8111-111111111111','댓글',110);ne_check($id===ne_comment($db,$a['entity'],'qa_a','11111111-1111-4111-8111-111111111111','댓글',111),'comment replay');
try{ne_delete($db,$id,'qa_b',false,115);throw new RuntimeException('owner bypass');}catch(DomainException $expected){}
ne_like($db,$a['entity'],'qa_a',false,false,130);ne_delete($db,$id,'qa_a',false,140);
$past=ne_metrics($db,120);$after=ne_metrics($db,150);ne_check($past[$a['entity']]===['likes'=>1,'comments'=>1],'historical snapshot');ne_check(!isset($after[$a['entity']]),'unlike/delete offset');
ne_check(ne_target($db,'video','abcdefghijk')['entity']==='video:abcdefghijk','video identity');$native=ne_target($db,'board','free:1');$member['mb_id']='qa_b';ne_check(ne_stats($db,$native)['likes']===1&&ne_stats($db,$native)['liked'],'existing native likes');ne_like($db,$native['entity'],'qa_b',false,true,200);ne_check(ne_stats($db,$native)['likes']===0,'native like override without native write');ne_check((int)$db->query('SELECT COUNT(*) FROM g5_board_good')->fetchColumn()===1,'native like data preserved');
// Leave a clean app fixture for browser operations; only disposable app tables are reset.
foreach(array_keys(ne_schema())as $t)$db->exec("TRUNCATE TABLE `$t`");
copy('public/coming/kpop-original.jpg',$root.'/cover.jpg');
$html= <<<'PHP'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko" data-noa-precision="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-engagement.css"><script type="application/json" id="noa-engagement-context"><?=json_encode(['member'=>!!$member])?></script><script src="/noa-engagement.js" defer></script></head><body class="noa-page"><main><h1>NOA STUDIO · 게시물 반응</h1><div class="noa-inline-song-row" data-inline-key="fixture-song"><button class="noa-inline-song"><img class="noa-inline-cover" src="/cover.jpg" alt=""><span class="noa-inline-title">EP.1 · 하루의 끝에</span></button><button class="noa-edit-edit" onclick="this.dataset.used='true'">수정</button><div class="noa-song-actions" data-admin-controls="true"><button class="noa-song-action noa-action" aria-label="하루의 끝에 재생" onclick="this.dataset.used='true'">▷<span>재생</span></button><button class="noa-song-action noa-action" aria-label="하루의 끝에 담기" onclick="this.dataset.used='true'">담기</button><button class="noa-song-action noa-action" aria-label="하루의 끝에 다운로드" onclick="this.dataset.used='true'">다운로드</button></div></div><section class="noa-card-grid"><a class="noa-music-card" data-video="abcdefghijk" href="#song"><div class="noa-art"><img src="/cover.jpg" alt=""></div><strong>EP.7 · 아직 그 자리에</strong><small>인기 점수 268 · YouTube 267 · 음원 1</small></a><a class="noa-music-card" data-video="abcdefghijk" href="#song"><div class="noa-art"><img src="/cover.jpg" alt=""></div><strong>흰수염고래 - 윤도현 밴드 (YB)</strong><small>인기 점수 260 · YouTube 260 · 음원 0</small></a></section><section data-noa-community="free"><details class="noa-community-post" id="noa-free-1" open><summary>자유게시판 글</summary><p>기존 게시물과 댓글은 보존됩니다.</p></details></section></main></body></html>
PHP;
file_put_contents($root.'/engagement-test.php',$html);@mkdir('engagement-proof',0700,true);file_put_contents('engagement-proof/mysql.json',json_encode(['additiveInstall'=>true,'canonicalAlias'=>true,'privateAndRestrictedDenied'=>true,'likeAndCommentReplay'=>true,'historicalCutoff'=>true,'deletionOwnerOnly'=>true,'nativeDataPreserved'=>true]));echo "ENGAGEMENT_MYSQL_PASS\n";

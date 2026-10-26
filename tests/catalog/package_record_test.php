<?php
declare(strict_types=1);require_once __DIR__.'/../../bridge/package-record.php';
function check(bool $ok,string $msg):void{if(!$ok)throw new RuntimeException($msg);}
function denied(callable $f,string $msg):void{try{$f();}catch(InvalidArgumentException|DomainException $e){return;}throw new RuntimeException($msg);}
$original=['genreId'=>'kpop-original','ep'=>'01','title'=>'원곡','body'=>['confirmedTitle'=>'원곡','lyricsBlock'=>"[Verse]\n원문",'unknownProductionEvidence'=>['keep'=>true]]];
$o=nup_patch($original,'single',['ep'=>'02','title'=>'새 원곡','lyrics'=>'원본 가사','vocal'=>'여자솔로','geminiPrompt'=>'사진','description'=>'설명','communityPost'=>'글','sunoUrl'=>'https://suno.com/s/example','cardImageLocation'=>'/data/noa-covers/card.webp','audioFileLocation'=>'/data/noa-audio/track.mp3','youtubeUrl'=>'https://youtu.be/abcdefghijk','mvUrl'=>'https://youtube.com/watch?v=zyxwvutsrqp']);
check($o['ep']==='02'&&$o['body']['originalInfo']['lyrics']==='원본 가사','original master is editable');check($o['body']['unknownProductionEvidence']===['keep'=>true],'unknown producer metadata retained');check(nup_fields($o)['communityPost']==='글','all content in complete record');
$ep=['genreId'=>'joseon-ballad','ep'=>'01','title'=>'개사곡','body'=>['lyricsBlock'=>'장르 가사']];
$e=nup_patch($ep,'single',['title'=>'확정 제목','lyrics'=>'번역 가사','vocal'=>'남녀듀엣']);check($e['packageType']==='ep'&&$e['ep']==='01','EP keeps source number');foreach(['ep','originalTitle','originalLyrics','sourceRef','genreId'] as $key)denied(fn()=>nup_patch($e,'single',[$key=>'hack']),'EP source must reject '.$key);
for($act=1;$act<=4;$act++){$list=['genreId'=>'joseon-ballad','act'=>$act,'title'=>'ACT '.$act,'body'=>[]];$members=[];foreach(range(($act-1)*10+1,$act*10) as $n)$members[]=['key'=>'single:ep:'.$n,'ep'=>$n];$p=nup_patch($list,'playlist',['members'=>$members]);check($p['epRange']===['from'=>($act-1)*10+1,'to'=>$act*10],'fixed ACT range');denied(fn()=>nup_patch($list,'playlist',['members'=>array_reverse($members)]),'ACT order denied');denied(fn()=>nup_patch($list,'playlist',['members'=>array_slice($members,1)]),'ACT needs ten');}
foreach(['your-story','cover-reborn'] as $genre){$p=nup_patch(['genreId'=>$genre,'title'=>'목록','body'=>[]],'playlist',['members'=>[['key'=>'one'],['key'=>'two'],['key'=>'three']]]);check($p['packageType']==='playlist'&&count($p['body']['members'])===3,'ordinary list has no ten-song rule');}
denied(fn()=>nup_patch($o,'single',['youtubeUrl'=>'javascript:alert(1)']),'URL scheme');denied(fn()=>nup_patch($o,'single',['sunoUrl'=>'https://evil.invalid/']),'URL source');denied(fn()=>nup_patch($o,'single',['audioFileLocation'=>'../../common.php']),'path traversal');
check(nup_policy()['priority']===0,'principle zero precedence');echo "UNIFIED_PACKAGE_TYPES_FIELDS_ORIGINAL_LOCKS_ACT_RANGES_URLS_PRESERVATION_OK\n";

$e=nup_patch($ep,'single',['sunoPrompt'=>'genre-specific Suno production prompt']);check(nup_fields($e)['sunoPrompt']==='genre-specific Suno production prompt','Suno prompt round trip in same record');

check(nup_patch($ep,'single',['vocal'=>'남녀듀엣'])['body']['thumbCast']==='duet','vocal selection and character projection share one record');

$legacy=$ep;$legacy['body']['sunoStyle']='existing production style';$updated=nup_patch($legacy,'single',['sunoPrompt'=>'updated production style']);check(nup_fields($updated)['sunoPrompt']===$updated['body']['sunoStyle'],'legacy producer reads the same edited Suno prompt');

$cover=nup_patch(["genreId"=>"cover-reborn","title"=>"커버곡","body"=>[]],"story",["originalArtist"=>"원곡 가수"]);check(nup_fields($cover)["originalArtist"]==="원곡 가수","cover artist persists in same record");denied(fn()=>nup_patch($ep,"single",["originalArtist"=>"wrong genre"]),"artist field belongs to covers");

$masked=['genreId'=>'joseon-ballad','title'=>'보존','body'=>['sunoPrompt'=>'','sunoStyle'=>'검증된 원본 스타일','summary'=>'기존 곡 소개','youtubeDescription'=>'영상 설명']];
check(nup_fields($masked)['sunoPrompt']==='검증된 원본 스타일','empty migrated field must not hide source style');
check(nup_fields($masked)['songDescription']==='기존 곡 소개','existing summary is visible as song introduction');
$separated=nup_patch($masked,'single',['description'=>'새 영상 설명','lyricsTranslation'=>'번역','productionPrompt'=>'제작','characterPrompt'=>'캐릭터']);
check(nup_fields($separated)['songDescription']==='기존 곡 소개'&&$separated['body']['summary']==='기존 곡 소개','YouTube edit preserves song introduction');
check(nup_fields($separated)['lyricsTranslation']==='번역'&&nup_fields($separated)['characterPrompt']==='캐릭터','production fields roundtrip');
$cleared=nup_patch($masked,'single',['sunoPrompt'=>'']);check(nup_fields($cleared)['sunoPrompt']==='','explicit clear is not restored');
$body=nup_merge_body(['sunoPrompt'=>'old','sunoStyle'=>'old'],['sunoPrompt'=>'old','sunoStyle'=>'new']);check($body['sunoPrompt']==='new'&&$body['sunoStyle']==='new','full editor updates canonical alias');
denied(fn()=>nup_merge_body(['sunoPrompt'=>'old','sunoStyle'=>'old'],['sunoPrompt'=>'one','sunoStyle'=>'two']),'different concurrent alias edits rejected');
echo "PRODUCTION_FIELDS_SOURCE_VISIBILITY_DESCRIPTION_SEPARATION_ALIAS_CONFLICT_OK\n";

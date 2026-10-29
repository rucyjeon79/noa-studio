<?php
require_once __DIR__.'/../../bridge/package-record.php';
function cover_check($value,$label){if(!$value)throw new RuntimeException($label);}
$old=['originalArtist'=>'old','originalSinger'=>'old','coverArtist'=>'old','vocalInfo'=>'여자솔로','vocal'=>'여자솔로','sourceVocal'=>'여자솔로','untouched'=>'preserve'];
$merged=nup_merge_body($old,['originalSinger'=>'new','vocal'=>'남녀듀엣']);
$d=['genreId'=>'cover-reborn','title'=>'커버곡','body'=>$merged];
cover_check(nup_fields($d)['originalArtist']==='new'&&nup_fields($d)['vocal']==='남녀듀엣','legacy editor roundtrip');
$patched=nup_patch($d,'story',['originalArtist'=>'수정 가수','vocal'=>'남자솔로']);
foreach(['originalArtist','originalSinger','coverArtist'] as $k)cover_check($patched['body'][$k]==='수정 가수','artist alias '.$k);
foreach(['vocalInfo','vocal','sourceVocal'] as $k)cover_check($patched['body'][$k]==='남자솔로','vocal alias '.$k);
cover_check($patched['body']['untouched']==='preserve','unrelated data');
$clear=nup_patch($patched,'story',['originalArtist'=>'','vocal'=>'']);
cover_check(nup_fields($clear)['originalArtist']==='수정 가수'&&nup_fields($clear)['vocal']==='남자솔로','blank patches preserve populated values');
$masked=['body'=>['originalArtist'=>' ','originalSinger'=>'가수','vocalInfo'=>'','vocal'=>'남자솔로','mvUrl'=>'','musicVideoUrl'=>'https://youtu.be/abcdefghijk']];
cover_check(nup_fields($masked)['originalArtist']==='가수'&&nup_fields($masked)['vocal']==='남자솔로'&&nup_fields($masked)['mvUrl']==='https://youtu.be/abcdefghijk','populated aliases beat blank canonical fields');
foreach([['originalArtist'=>'','originalSinger'=>'가수'],['originalArtist'=>'가수','originalSinger'=>''],['originalArtist'=>'  ','originalSinger'=>'가수']] as $input){$m=nup_merge_body([], $input);cover_check($m['originalArtist']==='가수'&&$m['originalSinger']==='가수','alias order does not matter');}
$m=nup_merge_body(['lyricsBlock'=>'가사','geminiPrompt'=>'이미지'],['lyricsBlock'=>'','geminiPrompt'=>null]);cover_check($m['lyricsBlock']==='가사'&&$m['geminiPrompt']==='이미지','same key keeps populated old value');
try{nup_merge_body([],['originalArtist'=>'A','originalSinger'=>'B']);throw new RuntimeException('conflict silently accepted');}catch(DomainException $e){}
echo "NONEMPTY_METADATA_PRECEDENCE_OK\n";
echo "COVER_ALIAS_ROUNDTRIP_OK\n";
if(getenv('NOA_MYSQL_DSN')){
 $db=new PDO(getenv('NOA_MYSQL_DSN'),'root','noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,?,?)')->execute(['story:cover-fixture','story',json_encode(['genreId'=>'cover-reborn','title'=>'커버곡','packageSchema'=>1,'body'=>$old]),1,'fixture']);
}

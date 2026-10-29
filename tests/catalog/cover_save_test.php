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
cover_check(nup_fields($clear)['originalArtist']===''&&nup_fields($clear)['vocal']==='','explicit clears persist');
echo "COVER_ALIAS_ROUNDTRIP_OK\n";
if(getenv('NOA_MYSQL_DSN')){
 $db=new PDO(getenv('NOA_MYSQL_DSN'),'root','noa-test-only',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,?,?)')->execute(['story:cover-fixture','story',json_encode(['genreId'=>'cover-reborn','title'=>'커버곡','packageSchema'=>1,'body'=>$old]),1,'fixture']);
}

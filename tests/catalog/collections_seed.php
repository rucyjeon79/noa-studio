<?php
require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/package-record.php';
$db=noa_bridge_pdo();$q=$db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,?,?)');
foreach(['a','b','c']as $id)$q->execute(['story:cover:'.$id,'story',json_encode(nup_normalize(['genreId'=>'cover-reborn','title'=>'커버 '.$id,'body'=>[]],'story')),1,'fixture']);
$q->execute(['playlist:custom:aaaaaaaaaaaaaaaaaaaaaaaa','playlist',json_encode(nup_normalize(['genreId'=>'cover-reborn','title'=>'테스트 목록','customPlaylistId'=>'aaaaaaaaaaaaaaaaaaaaaaaa','body'=>['members'=>[['key'=>'story:cover:a'],['key'=>'story:cover:b']]]],'playlist')),1,'fixture']);

<?php
/** Isolated SQL + native-markup fixtures; never copied to the operating site. */
declare(strict_types=1);define('_GNUBOARD_',true);
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_workspace_test;'))throw new RuntimeException('isolated_database_required');
require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/package-record.php';
$db=noa_bridge_pdo();$importUnread=str_repeat('5',64);$importLimits=str_repeat('6',64);$alias=str_repeat('7',64);$batch=str_repeat('f',64);
$keys=[];foreach([['story:amt-unread','미전송(Unread)','unread00001'],['story:amt-bloom','BLOOM','bloom000001'],['story:amt-limits','NO LIMITS','nolimit0001'],['catalog:'.$importUnread,'미전송(Unread) | 쓰고 지워도 끝내 보내지 못한 말 | 2026년 제2회 AMT AI 작곡대회 예선 참가곡','unread00001'],['catalog:'.$importLimits,'NO LIMITS | 남이 정한 기준을 지우고 진짜 나를 찾다 | 2026년 제2회 AMT AI 작곡대회 결선곡','nolimit0001']] as [$key,$title,$video]){
 $d=nup_normalize(['genreId'=>'your-story','title'=>$title,'visibility'=>'public','body'=>['confirmedTitle'=>$title,'youtubeUrl'=>'https://www.youtube.com/watch?v='.$video,'lyricsBlock'=>'원본 가사 보존','sunoPrompt'=>'원본 프롬프트 보존']],'story');$db->beginTransaction();nup_store($db,$key,'story',$d,0,'fixture');$db->commit();$keys[]=$key;
}
$db->prepare('INSERT INTO noa_catalog_aliases(batch_id,alias_key,entity_id) VALUES(?,?,?)')->execute([$batch,$keys[0],$alias]);
$id=str_repeat('e',24);$members=array_map(fn($key)=>['key'=>$key],array_merge([$alias],$keys));$d=nup_normalize(['genreId'=>'your-story','title'=>'2026년 제2회 AMT AI 작곡대회 | K-POP','visibility'=>'public','customPlaylistId'=>$id,'body'=>['members'=>$members]],'playlist');$db->beginTransaction();nup_store($db,'playlist:custom:'.$id,'playlist',$d,0,'fixture');$db->commit();
file_put_contents('workspace-proof/candidate/surfaces-data.json',json_encode(['playlist'=>$id,'sourceKeys'=>$keys,'sourceDocuments'=>5,'savedMembers'=>6,'expectedTitles'=>['미전송(Unread)','BLOOM','NO LIMITS'],'productionWrites'=>0],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
$root='/tmp/noa-pwa-fixture';copy('deploy/noa-gnuboard.css',$root.'/noa-gnuboard.css');copy('tests/workspace/board_fixture.php',$root.'/bbs/board.php');
echo "ACTUAL_MUSIC_YOUTUBE_LIBRARY_AND_NATIVE_MARKUP_FIXTURE_READY\n";

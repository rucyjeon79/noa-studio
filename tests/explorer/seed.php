<?php
declare(strict_types=1);define('_GNUBOARD_',true);require_once __DIR__.'/../../bridge/storage.php';require_once __DIR__.'/../../bridge/creator-core.php';$db=noa_bridge_pdo();if($db->query('SELECT DATABASE()')->fetchColumn()!=='noa_test')throw new RuntimeException('isolated database required');
foreach(['qa_five','qa_six'] as $owner){$hash=hash('sha256',$owner);$c=nc_row($db,nc_channel_key($owner));$d=$c['document'];$d['channelId']=$hash;nc_store($db,nc_channel_key($owner),'prefs',$d,$c['revision'],$owner);
 for($i=1;$i<=8;$i++)nc_store($db,'creator:'.$hash.':'.str_pad((string)$i,32,'0',STR_PAD_LEFT),'story',['ownerId'=>$owner,'title'=>($i===1?'같은 제목':'곡 '.$i),'genreId'=>$i<5?'your-story':'cover-reborn','visibility'=>'private','body'=>['originalArtist'=>$i<5?'':'원곡 아티스트']],0,$owner);
 nc_store($db,'playlist:'.$hash,'playlist',['ownerId'=>$owner,'title'=>'새벽의 곡 묶음','genreId'=>'your-story','visibility'=>'private','body'=>['members'=>[['key'=>'creator:'.$hash.':'.str_pad('1',32,'0',STR_PAD_LEFT)],['key'=>'creator:'.hash('sha256','foreign-owner').':'.str_repeat('9',32)]]]],0,$owner);
}
$rules=nc_rules(['rules'=>['common'=>'다정하고 시적인 말투','your-story'=>'따뜻한 피아노']]);if(count($rules)!==2)throw new RuntimeException('rules');try{nc_rules(['rules'=>['ownerId'=>'foreign']]);throw new RuntimeException('unknown rule accepted');}catch(InvalidArgumentException $e){}
echo "EXPLORER_FIXTURE_READY\n";

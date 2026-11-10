<?php
declare(strict_types=1);
/** Existing catalog module owns indexing and its read-only proof. */
function n80_catalog_index():array {
 require_once __DIR__.'/lab.php';
 return n80_lab_host_service('n80_listening_index');
}
function n80_catalog_readback(bool $moods=false):array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
 require_once $bridge.'/storage.php';require_once $bridge.'/youtube-store.php';
 require_once __DIR__.'/personal-song-index.php';require_once $bridge.'/listening-video-catalog.php';
 $db=noa_bridge_pdo();$indexed=(int)$db->query('SELECT COUNT(*) FROM noa_listening_song_index')->fetchColumn();
 $videos=n80_read_listening_videos($db);
 $result=['ok'=>true,'state'=>'host_owned','readOnly'=>true,'indexed'=>$indexed,'analyzed'=>0,'reused'=>$indexed,'written'=>0,'removed'=>0,'publicVideos'=>count($videos)];
 if($moods){$fields=array_flip(['key','browseIdentity','publicVideoId','genre','moodScores','moodAffinity']);$result['moodCatalog']=array_map(static fn($v)=>array_intersect_key($v,$fields),$videos);}
 return $result;
}

<?php
declare(strict_types=1);
if(!isset($context,$b))throw new RuntimeException('n80_dispatch_required');
require_once __DIR__.'/storage.php';
require_once __DIR__.'/youtube-store.php';
  require_once dirname(__DIR__).'/noa-app/engine/personal-song-index.php';
  require_once __DIR__.'/listening-video-catalog.php';
  $db=noa_bridge_pdo();
  $result=n80_refresh_song_index($db,static fn($visit)=>ny_listener_catalog($db,false,nie_overrides($db),$visit));
  if(!empty($b['verifyCatalog'])){
   $videos=n80_read_listening_videos($db);
   $result['publicVideos']=count($videos);
   if(!empty($b['verifyMoods'])){
    // Only non-personal song identifiers and indexed scores are needed for the queue audit.
    $fields=array_flip(['key','browseIdentity','publicVideoId','genre','moodScores','moodAffinity']);
    $result['moodCatalog']=array_map(static fn($v)=>array_intersect_key($v,$fields),$videos);
   }
  }
  return ['ok'=>true]+$result;

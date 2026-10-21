<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/youtube-store.php';require_once __DIR__.'/home-core.php';
/** Uses existing connection; SELECT-only and shared by endpoint and isolated audit. */
function nh_load(PDO $db,array $run):array{
 $videos=ny_videos($db,$run);$songs=ny_songs($db,ny_batch($db));$lists=[];$members=[];
 $q=$db->prepare('SELECT payload FROM noa_youtube_playlists WHERE run_id=?');$q->execute([$run['run_id']]);foreach($q as $r)$lists[]=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
 $q=$db->prepare('SELECT playlist_id,video_id FROM noa_youtube_items WHERE run_id=? ORDER BY playlist_id,position,item_id');$q->execute([$run['run_id']]);foreach($q as $r)$members[$r['playlist_id']][]=$r['video_id'];
  return nh_build($videos,$songs,$lists,$members,$run['channel_id']);
}

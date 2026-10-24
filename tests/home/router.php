<?php
// Isolated render harness. Never deployed.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/home.php'){header('Content-Type: application/json');readfile($root.'/quality-home/candidate.json');exit;}
if($path==='/'){define('_GNUBOARD_',true);$is_member=false;require $root.'/deploy/noa-app/home.php';exit;}
// Candidate identities stay intact; only their explicitly synthetic images and
// destinations are rendered locally. Real public items are checked separately.
if(in_array($path,['/noa-bridge/youtube-thumbnail.php','/noa-youtube.php'],true)){
 $data=json_decode(file_get_contents($root.'/quality-home/candidate.json'),true,512,JSON_THROW_ON_ERROR);$videos=[];$playlists=[];
 foreach(['featured','ep','stories','covers','playlists']as $section)foreach($data[$section]??[]as $row){if(!empty($row['videoId']))$videos[$row['videoId']]=true;if(!empty($row['playlistId']))$playlists[$row['playlistId']]=true;}
 if($path==='/noa-bridge/youtube-thumbnail.php'){
  if(!is_string($_GET['id']??null)||!isset($videos[$_GET['id']])){http_response_code(404);exit;}
  header('Content-Type: image/svg+xml');echo '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#17171a"/><circle cx="48" cy="48" r="25" fill="#c4a66c"/></svg>';exit;
 }
 $track=$_GET['track']??null;$playlist=$_GET['playlist']??null;
 if(!(is_string($track)&&isset($videos[$track]))&&!(is_string($playlist)&&isset($playlists[$playlist]))){http_response_code(404);exit;}
 header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><html><title>Isolated candidate destination</title><main><h1>Candidate fixture destination</h1></main></html>';exit;
}
if(str_starts_with($path,'/noa-assets/')||str_starts_with($path,'/noa-bridge/')){header('Location: https://noastudio.ai.kr'.$_SERVER['REQUEST_URI'],true,302);exit;}
return false;


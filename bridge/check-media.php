<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit;}
$id=$_GET['video']??'';
if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)){http_response_code(400);exit;}
$now=time();$recent=array_values(array_filter($_SESSION['noa_media_checks']??[],static fn($t)=>$t>$now-60));
if(count($recent)>=20){http_response_code(429);echo '{"status":"rate_limited"}';exit;}
$recent[]=$now;$_SESSION['noa_media_checks']=$recent;session_write_close();
$url='https://www.youtube.com/oembed?url='.rawurlencode('https://www.youtube.com/watch?v='.$id).'&format=json';
$context=stream_context_create(['http'=>['timeout'=>8,'ignore_errors'=>true,'header'=>"User-Agent: NOA-STUDIO\r\n"],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
$raw=@file_get_contents($url,false,$context,0,65536);$data=is_string($raw)?json_decode($raw,true):null;
$public=is_array($data)&&($data['type']??'')==='video';
echo json_encode(['youtubeId'=>$id,'status'=>$public?'public':'unverified','checkedAt'=>gmdate('c')],JSON_THROW_ON_ERROR);

<?php
declare(strict_types=1);
require __DIR__.'/common.php';require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/member-access.php';require_once __DIR__.'/noa-app/jukebox/core.php';require_once __DIR__.'/noa-bridge/music-download-core.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
$access=nam_access((array)($member??[]),(string)($is_admin??''));if(!$access['member']){header('Location: /noa-login.php?url='.rawurlencode($_SERVER['REQUEST_URI']));exit;}
function nmd_e($s):string{return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$key=$_GET['key']??'';$error='';$a=null;$receipt=null;
$messages=['song_unavailable'=>'현재 다운로드할 수 없는 곡이에요.','audio_unavailable'=>'최적화 음원을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.','song_owner_unresolved'=>'곡 주인의 지급 계정을 확인하고 있어요. 포인트는 차감되지 않았어요.','insufficient_points'=>'보유 포인트가 부족해요. 1,000P를 준비한 뒤 다시 받아 주세요.','audio_changed'=>'음원이 새 버전으로 바뀌었어요. 곡 목록에서 다시 열어 주세요.','purchase_conflict'=>'이전 요청과 곡 정보가 달라요. 곡 목록에서 다시 열어 주세요.','csrf_required'=>'화면을 새로 열고 다시 확인해 주세요.'];
try{
 if(!is_string($key))throw new DomainException('song_unavailable');$db=noa_bridge_pdo();$a=nmd_asset($db,$key,$member,$access['admin']);
 if($access['admin']){header('Location: /noa-app/jukebox/download.php?key='.rawurlencode($key));exit;}
 if(empty($_SESSION['noa_download_csrf']))$_SESSION['noa_download_csrf']=bin2hex(random_bytes(32));
 if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
  if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['noa_download_csrf'],$_POST['csrf']))throw new DomainException('csrf_required');
  $id=$_POST['requestId']??'';if(!is_string($id)||!isset($_SESSION['noa_download_quotes'][$id]))throw new DomainException('csrf_required');$quote=$_SESSION['noa_download_quotes'][$id];
  if($quote['key']!==$key)throw new DomainException('purchase_conflict');
  $receipt=nmd_purchase((string)$member['mb_id'],$id,$quote,fn()=>nmd_asset($db,$key,$member),time());
  header('Location: /noa-music-download.php?'.http_build_query(['key'=>$key,'receipt'=>$id]),true,303);exit;
 }
 if(isset($_GET['receipt'])&&is_string($_GET['receipt']))$receipt=nmd_receipt((string)$member['mb_id'],$_GET['receipt'],$key);
 if(!$receipt){$id=sprintf('%s-%s-4%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),substr(bin2hex(random_bytes(2)),1),'8'.substr(bin2hex(random_bytes(2)),1),bin2hex(random_bytes(6)));$_SESSION['noa_download_quotes'][$id]=array_intersect_key($a,array_flip(['key','sha','ownerId']));$_SESSION['noa_download_quotes']=array_slice($_SESSION['noa_download_quotes'],-30,null,true);}
}catch(Throwable $e){$error=$messages[$e->getMessage()]??'처리를 완료하지 못했어요. 같은 요청으로 다시 시도해 주세요.';http_response_code(409);$key=is_string($key)?$key:'';}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>프리미엄 음원 다운로드 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main style="max-width:640px;margin:auto;padding:24px 16px"><p class="noa-eyebrow">PREMIUM MASTER</p><h1>음원 다운로드</h1><h2><?=nmd_e($a['title']??'곡 확인')?></h2><?php if($error):?><p role="alert"><?=nmd_e($error)?></p><a class="noa-button" href="<?=nmd_e('/noa-music-download.php?key='.rawurlencode($key))?>">다시 확인</a><?php elseif($receipt):?><p>다운로드 준비가 끝났어요. 1,000P 중 500P가 곡 주인에게 지급됐어요.</p><a id="music-download-file" class="noa-button" href="<?=nmd_e('/noa-app/jukebox/download.php?'.http_build_query(['key'=>$key,'receipt'=>$receipt['id']]))?>">최적화 MP3 받기</a><p class="noa-muted">이 페이지의 받기 버튼으로 다시 시도해도 추가 차감되지 않아요.</p><?php else:?><p>직접 업로드하고 최적화·검증을 마친 MP3 음원이에요.</p><p><strong>1,000P</strong> · 곡 주인에게 500P 지급</p><p>현재 보유 포인트: <?=number_format((int)get_point_sum((string)$member['mb_id']))?>P</p><form method="post"><input type="hidden" name="csrf" value="<?=nmd_e($_SESSION['noa_download_csrf'])?>"><input type="hidden" name="requestId" value="<?=nmd_e($id)?>"><button class="noa-button" type="submit">1,000P 차감하고 다운로드 준비</button></form><?php endif;?><p><a href="/noa-music.php">음원 목록으로</a></p></main></body></html>

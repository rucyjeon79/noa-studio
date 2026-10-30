<?php
declare(strict_types=1);
if(is_file(__DIR__.'/music-proof-auth.php'))require_once __DIR__.'/music-proof-auth.php';
/** Explicit roles. A numeric staff level never implies highest-administrator access. */
function nam_access(array $member=[],string $admin=''):array{
 $logged=!empty($member['mb_id']);$level=$logged?max(1,min(10,(int)($member['mb_level']??2))):1;$super=$logged&&$admin==='super';
 $base=$logged&&$level>=2;$write=$logged&&$level>=3;$vip=$logged&&in_array($level,[4,6],true);$creator=$logged&&in_array($level,[5,6],true);
 $names=[1=>'방문자',2=>'별하나 회원',3=>'별무리 회원',4=>'별무리 VIP회원',5=>'크레이터 회원',6=>'크레이터 VIP회원',7=>'관리자',8=>'관리자',9=>'관리자',10=>'최고 관리자'];
 return ['level'=>$level,'name'=>$super?'최고 관리자':$names[$level],'home'=>true,'member'=>$base||$super,'write'=>$write||$super,'music'=>$vip||$super||(function_exists('nmr_current')&&nmr_current()),'creator'=>$creator||$super,'creatorAI'=>($logged&&$level===6)||$super,'ownDownload'=>$base||$super,'admin'=>$super];
}
function nam_owner(array $document,array $member):bool{
 return !empty($member['mb_id'])&&is_string($document['ownerId']??null)&&hash_equals($document['ownerId'],(string)$member['mb_id']);
}
/** Null means leave the endpoint's existing authentication contract intact. */
function nam_requirement(string $path,string $method='GET',array $query=[]):?string{
 if($path==='/noa-sitemap.php')return 'home';
 if($path==='/noa-install.php')return 'home';
 if($path==='/'||$path==='/index.php'||$path==='/noa-app/home.php'||$path==='/noa2.php')return 'home';
 if(str_starts_with($path,'/adm/'))return 'admin';
 if($path==='/noa-subscription-admin.php')return 'admin';
 if(in_array($path,['/noa-subscription.php','/noa-bridge/subscription.php'],true))return 'member';
 if(in_array($path,['/noa-creator-review.php'],true))return 'admin';
 if(in_array($path,['/noa-channel-workspace.php'],true))return 'creator';
 if(in_array($path,['/noa-creator-ai.php','/noa-bridge/creator-ai.php'],true))return 'creatorAI';
 if($path==='/noa-channel-rules.php'||$path==='/noa-creator.php'||$path==='/noa-bridge/creator.php')return 'creator';
 if($path==='/noa-bridge/legacy-audio.php')return null;
 if($path==='/noa-app/jukebox/stream.php'||$path==='/noa-app/jukebox/download.php')return null; // asset ownership checked after loading the record
 if(in_array($path,['/noa-music.php','/noa-music-download.php'],true))return 'member';
 if($path==='/noa-catalog.php'||$path==='/noa-bridge/user-playlists.php'||$path==='/noa-bridge/music-detail.php')return 'music';
 if(in_array($path,['/noa-bridge/catalog.php','/noa-channel.php','/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-settings.php','/noa-sitemap.php','/noa-download.php','/noa-bridge/world-story.php','/noa-bridge/world-mv.php'],true))return 'member';
 if(preg_match('~^/noa-(?:library|editor|ai-lab|recovery|theme-admin|catalog-admin|youtube-admin|category-order-admin)[.]php$~D',$path)||preg_match('~^/noa-app/(?:database|taxonomy|popularity|jukebox)/(?:index[.]php)?$~D',$path))return 'admin';
 if(str_starts_with($path,'/bbs/')){
  $file=basename($path);
  if(preg_match('/^(?:login|login_check|logout|register|register_form|register_form_update|password_lost|password_lost2|password_reset|email_certify|email_certify2|formmail_send)[.]php$/D',$file))return null;
  if($file==='content.php'&&in_array($query['co_id']??'',['privacy','provision'],true))return 'home';
  if(preg_match('/^(?:write|write_update|write_comment_update|delete|delete_all|delete_comment|move|move_update)[.]php$/D',$file))return 'write';
  return 'member';
 }
 return null;
}
function nam_allowed(array $access,?string $need):bool{return $need===null||!empty($access[$need]);}

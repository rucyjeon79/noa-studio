<?php
declare(strict_types=1);
/** N80 Sign: pure role and ownership checks; existing session/OAuth providers remain authoritative. */
const NOA_MEMBER_TITLES = [
 1=>'방문자', 2=>'별하나 회원', 3=>'별무리 회원', 4=>'별무리 VIP회원',
 5=>'갤럭시 회원', 6=>'스타 클러스터', 7=>'크레이터 회원',
 8=>'크레이터 VIP회원', 9=>'관리자', 10=>'최고 관리자',
];
/** Explicit roles. A numeric staff level never implies highest-administrator access. */
function n80_sign_access(array $member=[],string $admin=''):array{
 $logged=!empty($member['mb_id']);$level=$logged?max(1,min(10,(int)($member['mb_level']??2))):1;$super=$logged&&$admin==='super';
 $base=$logged&&$level>=2;$write=$logged&&$level>=3;$vip=$logged&&in_array($level,[4,5,6,8],true);$creator=$logged&&in_array($level,[7,8],true);

 $weather=$logged&&in_array($level,[4,5,6,8,9,10],true);
 $music=$vip||$super||(function_exists('nmr_current')&&nmr_current());
 return ['level'=>$level,'name'=>$super?'최고 관리자':NOA_MEMBER_TITLES[$level],'home'=>true,'member'=>$base||$super,'write'=>$write||$super,'weatherVip'=>$weather,'premiumPlayback'=>$music||$weather,'music'=>$music,'creator'=>$creator||$super,'creatorAI'=>($logged&&$level===8)||$super,'ownDownload'=>$base||$super,'admin'=>$super];
}
function n80_sign_owner(array $document,array $member):bool{
 return !empty($member['mb_id'])&&is_string($document['ownerId']??null)&&hash_equals($document['ownerId'],(string)$member['mb_id']);
}
/** Null means leave the endpoint's existing authentication contract intact. */
function n80_sign_requirement(string $path,string $method='GET',array $query=[]):?string{
 if($path==='/noa-sitemap.php')return 'home';
 if($path==='/noa-install.php')return 'home';
 if($path==='/'||$path==='/index.php'||$path==='/noa-app/home.php'||$path==='/noa2.php')return 'home';
 if(str_starts_with($path,'/adm/'))return 'admin';
 if($path==='/noa-subscription-admin.php')return 'admin';
 if(in_array($path,['/noa-subscription.php','/noa-bridge/subscription.php'],true))return 'member';
 if(in_array($path,['/noa-creator-review.php'],true))return 'admin';
 if(in_array($path,['/noa-channel-workspace.php'],true))return 'creator';
 if($path==='/noa-ai-lab.php'){
  $tool=$query['tool']??'';
  if($tool==='')return 'member';
  require_once __DIR__.'/ai-lab.php';
  return is_string($tool)?(n80_lab_tools()[$tool]['access']??'member'):'member';
 }
 if(in_array($path,['/noa-creator-ai.php','/noa-bridge/creator-ai.php','/noa-lab-creative.php','/noa-bridge/creative.php'],true))return 'creatorAI';
 if($path==='/noa-channel-rules.php'||$path==='/noa-creator.php'||$path==='/noa-bridge/creator.php')return 'creator';
 if($path==='/noa-bridge/legacy-audio.php')return null;
 if($path==='/noa-app/jukebox/stream.php'||$path==='/noa-app/jukebox/download.php')return null; // asset ownership checked after loading the record
 if($path==='/noa-music.php'&&$method==='GET'&&function_exists('nmr_current')&&nmr_current())return 'music';
 if(in_array($path,['/noa-music.php','/noa-music-download.php'],true))return 'member';
 if($path==='/noa-catalog.php'||$path==='/noa-bridge/user-playlists.php'||$path==='/noa-bridge/music-detail.php')return 'music';
 if(in_array($path,['/noa-bridge/catalog.php','/noa-channel.php','/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-settings.php','/noa-sitemap.php','/noa-download.php','/noa-bridge/world-story.php','/noa-bridge/world-mv.php'],true))return 'member';
 if(preg_match('~^/noa-(?:library|editor|recovery|theme-admin|catalog-admin|youtube-admin|category-order-admin)[.]php$~D',$path)||preg_match('~^/noa-app/(?:database|taxonomy|popularity|jukebox)/(?:index[.]php)?$~D',$path))return 'admin';
 if(str_starts_with($path,'/bbs/')){
  $file=basename($path);
  if(preg_match('/^(?:login|login_check|logout|register|register_form|register_form_update|password_lost|password_lost2|password_reset|email_certify|email_certify2|formmail_send)[.]php$/D',$file))return null;
  if($file==='content.php'&&in_array($query['co_id']??'',['privacy','provision'],true))return 'home';
  if(preg_match('/^(?:write|write_update|write_comment_update|delete|delete_all|delete_comment|move|move_update)[.]php$/D',$file))return 'write';
  return 'member';
 }
 return null;
}
function n80_sign_allowed(array $access,?string $need):bool{return $need===null||!empty($access[$need]);}

/** Existing membership renewal, fan credits and maintenance receipt; scheduled by Hub. */
function n80_sign_maintain():array {
 $bridge=dirname(__DIR__,2).'/noa-bridge';
  require_once $bridge.'/subscription-core.php';require_once $bridge.'/membership-core.php';
  if(empty(nr_policy()['enabled']))throw new RuntimeException('hub_membership_not_active');
  $rows=ns_q('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_level BETWEEN 2 AND 4 ORDER BY mb_id');$owners=[];
  while($row=sql_fetch_array($rows)){$owners[]=$row['mb_id'];if(count($owners)>10000)throw new RuntimeException('hub_maintenance_batch_limit');}
  $counts=[];foreach($owners as $owner){$r=nr_renew($owner,time());nr_refresh($owner,time());$counts[$r['state']]=($counts[$r['state']]??0)+1;}
  if(is_file($bridge.'/fan-membership.php')){
   require_once $bridge.'/fan-membership.php';$fans=ns_q('SELECT mb_id FROM '.ns_table('member_table')." WHERE mb_level IN (5,6) AND mb_leave_date='' AND mb_intercept_date=''");
   while($fan=sql_fetch_array($fans))if(nfan_monthly($fan['mb_id'],time())>0)$counts['fanCredits']=1+($counts['fanCredits']??0);
  }
  $result=['membersChecked'=>count($owners),'results'=>$counts];
  ns_atomic('membership-maintenance',false,function()use($result){$key='membership:maintenance';$old=ns_doc($key,true);ns_put($key,'membership_maintenance',['checkedAt'=>time()]+$result,$old['revision']??0,'n80-membership-worker');});
  return ['ok'=>true]+$result;
}

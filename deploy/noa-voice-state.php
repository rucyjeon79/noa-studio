<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_'))exit;
/** Authenticated, read-only welcome facts. No provider calls or point charges. */
function noa_voice_state(array $member,array $access):array{
 $logged=!empty($member['mb_id']);
 $out=['ok'=>true,'member'=>$logged,'displayName'=>$logged?(trim(strip_tags((string)($member['mb_nick']??$member['mb_name']??'')))?:'회원'):'방문자','accountKey'=>$logged?hash('sha256',session_id().'|'.$member['mb_id']):'guest','subscription'=>'비로그인','remainingDays'=>null,'balance'=>$logged&&isset($member['mb_point'])?(int)$member['mb_point']:null,'capabilities'=>$access];
 if(!$logged)return $out;
 try{
  $grant=ns_read_grant(noa_bridge_pdo(),(string)$member['mb_id']);
  if(!empty($access['admin'])){$out['subscription']='관리자 이용';}
  elseif($grant&&($grant['status']??'')==='active'&&($grant['until']??0)>time()){$out['subscription']='구독 중';$out['remainingDays']=max(0,(int)ceil(($grant['until']-time())/86400));}
  elseif($grant){$out['subscription']='구독 만료';$out['remainingDays']=0;}
  elseif(!empty($access['music'])){$out['subscription']='VIP 이용 중 · 종료일 미등록';}
  else{$out['subscription']='구독 없음';$out['remainingDays']=0;}
 }catch(Throwable $e){$out['subscription']='확인 중';error_log('[noa-welcome] '.get_class($e));}
 return $out;
}

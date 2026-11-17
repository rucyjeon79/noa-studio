<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/lab-core.php';

function nd_shorts_public(array $c):array {
 if(isset($c['preparation']))unset($c['preparation']['lease'],$c['preparation']['sources'],$c['preparation']['connectionReceipt']);
 if(isset($c['preparation']['subtitlePreparation']))unset($c['preparation']['subtitlePreparation']['lease'],$c['preparation']['subtitlePreparation']['sourceFingerprint']);
 $c['enabled']=false;$c['state']='retired';$c['productionReady']=false;$c['nextPreparationAt']=null;$c['nextPublicationAt']=null;
 return $c;
}

/** Durable campaign ownership in the existing N80 store; never a conversation timer. */
function nd_shorts_policy():array {
 $path=dirname(__DIR__).'/noa-app/engine/daily-shorts.json';
 $p=json_decode((string)file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
 if(($p['timezone']??'')!=='Asia/Seoul'||($p['publishLocalTime']??'')!=='12:00'||($p['prepareLocalTime']??'')!=='08:00'||($p['maxPerLocalDate']??0)!==1||($p['minSeconds']??0)!==49||($p['maxSeconds']??0)!==59)throw new DomainException('invalid_daily_shorts_policy');
 $storage=$p['mediaStorage']??[];
 if(($storage['provider']??'')!=='google_drive'||!preg_match('/^[A-Za-z0-9_-]{10,200}$/D',(string)($storage['temporaryParentFolderId']??'')))throw new DomainException('shorts_google_drive_required');
 nd_shorts_weekdays($p);
 return $p;
}
function nd_shorts_weekdays(array $p):array {
 $days=$p['publishIsoWeekdays']??null;
 if(!is_array($days)||!array_is_list($days)||!count($days)||count($days)>7||count(array_unique($days))!==count($days))throw new DomainException('invalid_shorts_weekdays');
 foreach($days as $day)if(!is_int($day)||$day<1||$day>7)throw new DomainException('invalid_shorts_weekdays');
 return $days;
}
/** The tick and all preparation stages use the same timezone-aware calendar. */
function nd_shorts_schedule(array $p,int $now):array {
 $days=nd_shorts_weekdays($p);$zone=new DateTimeZone($p['timezone']);
 $local=(new DateTimeImmutable('@'.$now))->setTimezone($zone);
 [$hour,$minute]=array_map('intval',explode(':',$p['publishLocalTime']));
 $target=$local->setTime($hour,$minute);
 while($target<=$local||!in_array((int)$target->format('N'),$days,true))$target=$target->modify('+1 day');
 [$hour,$minute]=array_map('intval',explode(':',$p['prepareLocalTime']));
 return ['local'=>$local,'target'=>$target,'due'=>$target->setTime($hour,$minute)];
}
function nd_shorts_slot_allowed(array $p,string $publishAt):bool {
 try{$target=new DateTimeImmutable($publishAt);}catch(Exception $e){return false;}
 $target=$target->setTimezone(new DateTimeZone($p['timezone']));
 return in_array((int)$target->format('N'),nd_shorts_weekdays($p),true)&&$target->format('H:i:s')===$p['publishLocalTime'].':00';
}
function nd_shorts_readiness(array $s,array $p):array {
 return ['ready'=>false,'retired'=>true,'missing'=>[],'reason'=>'automatic_shorts_retired','sessionBrowserIsServerExecutor'=>false];
}
function nd_shorts_tick(array &$s,array $p,int $now,array $readiness):array {
 // Preserve the complete historical campaign; no new slot, lease or media operation.
 return ['ok'=>true,'state'=>'retired','campaign'=>nd_shorts_public($s['campaigns']['daily_shorts']??[]),'processed'=>0,'uploads'=>0,'executionAllowed'=>false];
}

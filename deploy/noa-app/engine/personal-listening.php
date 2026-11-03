<?php
declare(strict_types=1);
/** N80 personal listening: symbolic themes, never a medical or emotion measurement. */
function n80_listening_genres():array{return ['kpop-original'=>'K-POP Original','jpop-original'=>'J-POP Original','pop-original'=>'POP Original','thai-original'=>'Thai Original','joseon-ballad'=>'Joseon Ballad','echoes-of-joseon'=>'Echoes of Joseon','groovy-airy-pop'=>'Groovy Airy Pop','narrative-piano-indie'=>'Narrative Piano Indie','dreamy-deep-house'=>'Dreamy Deep House','fantasy-ambient-edm'=>'Fantasy Ambient EDM','edm-kpop-club'=>'EDM K-POP Club','latin-afrobeats-edm'=>'Latin Afrobeats EDM','panpop'=>'PANPOP','your-story'=>'당신의 이야기, 우리의 음악','cover-reborn'=>'AInoa의 유명곡 커버'];}
function n80_listening_profile(array $input,?DateTimeImmutable $now=null):array{
 $now??=new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul'));
 $genre=$input['genre']??'kpop-original';$zone=$input['timezone']??'Asia/Seoul';
 if(!is_string($genre)||!isset(n80_listening_genres()[$genre])||!is_string($zone)||!in_array($zone,DateTimeZone::listIdentifiers(),true))throw new DomainException('invalid_preference');
 $out=['genre'=>$genre,'timezone'=>$zone,'consent'=>($input['consent']??false)===true];
 if(!$out['consent'])return $out;
 $date=$input['birthDate']??'';$calendar=$input['calendar']??'solar';$time=$input['birthTime']??'';$birthZone=$input['birthTimezone']??'Asia/Seoul';$leap=($input['leap']??false)===true;
 if(!is_string($date)||!preg_match('/^(19\d{2}|20\d{2})-(\d{2})-(\d{2})$/D',$date,$m)||!in_array($calendar,['solar','lunar'],true)||!is_string($time)||($time!==''&&!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$time))||!is_string($birthZone)||!in_array($birthZone,DateTimeZone::listIdentifiers(),true))throw new DomainException('invalid_birth');
 $y=(int)$m[1];$month=(int)$m[2];$day=(int)$m[3];$solar=$date;
 if($calendar==='solar'){if(!checkdate($month,$day,$y)||$leap)throw new DomainException('invalid_birth');}
 else{
  $months=json_decode((string)file_get_contents(__DIR__.'/personal-korean-months.json'),true,512,JSON_THROW_ON_ERROR);$entry=$months[sprintf('%d-%02d-%d',$y,$month,(int)$leap)]??null;
  if(!$entry||$day<1||$day>$entry[1])throw new DomainException('invalid_lunar_date');
  $solar=(new DateTimeImmutable($entry[0],new DateTimeZone('Asia/Seoul')))->modify('+'.($day-1).' days')->format('Y-m-d');
 }
 if($solar>$now->setTimezone(new DateTimeZone($birthZone))->format('Y-m-d'))throw new DomainException('future_birth');
 return $out+['birthDate'=>$date,'calendar'=>$calendar,'leap'=>$leap,'birthTime'=>$time,'birthTimezone'=>$birthZone,'solarDate'=>$solar];
}
function n80_listening_theme(array $profile,?DateTimeImmutable $now=null):array{
 $now??=new DateTimeImmutable('now',new DateTimeZone('UTC'));$local=$now->setTimezone(new DateTimeZone($profile['timezone']??'Asia/Seoul'));$hour=(int)$local->format('G');
 $period=$hour<6?'늦은 밤':($hour<11?'아침':($hour<17?'오후':($hour<21?'저녁':'밤')));
 $base=$hour<6||$hour>=21?'calm':($hour<11?'energy':($hour<17?'focus':'comfort'));
 $scores=['calm'=>0.0,'energy'=>0.0,'focus'=>0.0,'comfort'=>0.0];$scores[$base]=2.5;$pillars=[];$rhythms=[];
 if(!empty($profile['consent'])&&!empty($profile['solarDate'])){
  require_once __DIR__.'/personal-calendar-vendor.php';
  $birth=new DateTimeImmutable($profile['solarDate'].' '.(($profile['birthTime']??'')?:'12:00'),new DateTimeZone($profile['birthTimezone']));
  // Solar terms use the library's UTC+8 clock; day/hour use the entered local standard time.
  $solar=static fn(DateTimeImmutable $d)=>\com\nlf\calendar\Solar::fromYmdHms((int)$d->format('Y'),(int)$d->format('n'),(int)$d->format('j'),(int)$d->format('G'),(int)$d->format('i'),0)->getLunar()->getEightChar();
  $localChart=$solar($birth);$termChart=$solar($birth->setTimezone(new DateTimeZone('Asia/Shanghai')));$localChart->setSect(2);
  $pillars=['year'=>$termChart->getYear(),'month'=>$termChart->getMonth(),'day'=>$localChart->getDay()];
  $elements=$termChart->getYearWuXing().$termChart->getMonthWuXing().$localChart->getDayWuXing();
  if(($profile['birthTime']??'')!==''){$pillars['hour']=$localChart->getTime();$elements.=$localChart->getTimeWuXing();}
  // Product interpretation: seasonal/element imagery contributes only a small theme weight.
  foreach(['木'=>'energy','火'=>'energy','土'=>'comfort','金'=>'focus','水'=>'calm'] as $element=>$mood)$scores[$mood]+=mb_substr_count($elements,$element)*.22;
  $days=(int)(new DateTimeImmutable($profile['solarDate'],new DateTimeZone('UTC')))->diff(new DateTimeImmutable($local->format('Y-m-d'),new DateTimeZone('UTC')))->format('%r%a');
  foreach(['physical'=>23,'emotional'=>28,'intellectual'=>33] as $key=>$cycle)$rhythms[$key]=round(sin(2*M_PI*$days/$cycle),4);
  $scores['energy']+=max(0,$rhythms['physical'])*1.3;$scores['calm']+=max(0,-$rhythms['physical'])*1.3;$scores['comfort']+=max(0,-$rhythms['emotional'])*1.3;$scores['focus']+=max(0,$rhythms['intellectual'])*1.3;
 }
 arsort($scores);$mood=array_key_first($scores);$labels=['calm'=>'휴식','energy'=>'활력','focus'=>'집중','comfort'=>'위로'];
 return ['mood'=>$mood,'label'=>$labels[$mood],'period'=>$period,'localDate'=>$local->format('Y-m-d'),'timezone'=>$local->getTimezone()->getName(),'personal'=>!!$pillars,'pillars'=>$pillars,'birthTimeKnown'=>isset($pillars['hour']),'rhythms'=>$rhythms,'validUntil'=>$now->modify('+15 minutes')->getTimestamp(),'basis'=>$pillars?'사주 해석 · 바이오리듬 주기 · 시간대':'시간대','notice'=>'사주와 바이오리듬은 음악을 고르는 해석적 테마이며 실제 감정·건강의 측정값이 아닙니다. 직접 고른 분위기가 우선합니다.'];
}
function n80_listening_tags(array $body):array{
 $text=implode(' ',array_filter(array_map(static fn($key)=>is_string($body[$key]??null)?$body[$key]:'',['sunoStyle','sunoStylePrompt','stylePrompt','sunoPrompt','style','mood','songDescription','descriptionBlock'])));
 $rules=['calm'=>'calm|relax|ambient|gentle|soft piano|휴식|잔잔|차분|명상','energy'=>'energetic|upbeat|dance|driving beat|high energy|활기|신나는|댄스|경쾌','focus'=>'instrumental|minimal|lo-fi|lofi|piano solo|집중|연주곡|미니멀','comfort'=>'warm|comfort|healing|tender|emotional ballad|위로|따뜻|포근|치유'];$tags=[];
 foreach($rules as $tag=>$pattern)if(preg_match('/'.$pattern.'/iu',$text))$tags[]=$tag;
 return $tags;
}

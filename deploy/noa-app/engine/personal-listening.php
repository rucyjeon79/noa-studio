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
 return $out+['fortuneAlerts'=>($input['fortuneAlerts']??false)===true,'birthDate'=>$date,'calendar'=>$calendar,'leap'=>$leap,'birthTime'=>$time,'birthTimezone'=>$birthZone,'solarDate'=>$solar];
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

/** A light reading of the relationship between the natal and today's day stems.
 * Use the Korean calendar day, independent of device clock or listening timezone.
 * Only the reading, never the natal chart or birthday, belongs in a push payload. */
function n80_daily_fortune(array $pillars,DateTimeImmutable $at):?array{
 if(empty($pillars['day']))return null;
 require_once __DIR__.'/personal-calendar-vendor.php';
 $kst=$at->setTimezone(new DateTimeZone('Asia/Seoul'));
 $chart=\com\nlf\calendar\Solar::fromYmdHms((int)$kst->format('Y'),(int)$kst->format('n'),(int)$kst->format('j'),12,0,0)->getLunar()->getEightChar();
 $stems='甲乙丙丁戊己庚辛壬癸';
 $n=mb_strpos($stems,mb_substr($pillars['day'],0,1));$d=mb_strpos($stems,mb_substr($chart->getDay(),0,1));if($n===false||$d===false)return null;
 $relation=(intdiv($d,2)-intdiv($n,2)+5)%5;
 $readings=[
  ['함께하면 가벼워지는 날','혼자 붙잡고 있던 일에 다른 사람의 시선이 보탬이 될 수 있어요.','오늘 듣고 싶은 곡을 골라 가까운 사람에게 건네 보세요.','부탁하고 싶었던 작은 일 하나를 말로 꺼내 보세요.'],
  ['표현에 힘이 실리는 날','마음속에만 두었던 생각을 밖으로 꺼내기 좋은 흐름이에요.','떠오른 생각을 다듬기 전에 한 문장으로 적어 보세요.','고마웠던 순간 하나를 떠올려 그 사람에게 들려주세요.'],
  ['작은 마무리가 빛나는 날','새 일을 더하기보다 손에 잡힌 일에서 기쁨을 찾기 좋은 날이에요.','오늘 끝낼 수 있는 일 하나를 고르고 첫 단계부터 해 보세요.','미뤄 둔 답장 하나를 보내고 잠깐 숨을 돌려 보세요.'],
  ['속도를 고르는 날','요청이 겹친다면 잠깐 멈춰 무엇을 먼저 할지 골라 보세요.','일정 사이에 좋아하는 노래 한 곡만큼 여백을 남겨 보세요.','오늘 꼭 지키고 싶은 약속 하나에 먼저 시간을 내 보세요.'],
  ['익숙한 것에서 힌트를 얻는 날','전에 들은 말이나 오래된 노래가 오늘은 다르게 다가올 수 있어요.','한동안 듣지 않았던 곡을 다시 틀고 마음에 남는 구절을 찾아보세요.','예전에 적어 둔 메모 한 장을 다시 읽어 보세요.']
 ];
 [$headline,$body,$a,$b]=$readings[$relation];
 return ['date'=>$kst->format('Y-m-d'),'headline'=>$headline,'body'=>$body,'tip'=>($d%2)?$a:$b];
}

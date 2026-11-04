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
 $pillars=[];$rhythms=[];$rankedMoods=[];$reading='';$mood=$base;
 if(!empty($profile['consent'])&&!empty($profile['solarDate'])){
  require_once __DIR__.'/personal-calendar-vendor.php';
  $birth=new DateTimeImmutable($profile['solarDate'].' '.(($profile['birthTime']??'')?:'12:00'),new DateTimeZone($profile['birthTimezone']));
  // Solar terms use the library's UTC+8 clock; day/hour use the entered local standard time.
  $solar=static fn(DateTimeImmutable $d)=>\com\nlf\calendar\Solar::fromYmdHms((int)$d->format('Y'),(int)$d->format('n'),(int)$d->format('j'),(int)$d->format('G'),(int)$d->format('i'),0)->getLunar()->getEightChar();
  $localChart=$solar($birth);$termChart=$solar($birth->setTimezone(new DateTimeZone('Asia/Shanghai')));$localChart->setSect(2);
  $pillars=['year'=>$termChart->getYear(),'month'=>$termChart->getMonth(),'day'=>$localChart->getDay()];
  $elements=$termChart->getYearWuXing().$termChart->getMonthWuXing().$localChart->getDayWuXing();
  if(($profile['birthTime']??'')!==''){$pillars['hour']=$localChart->getTime();$elements.=$localChart->getTimeWuXing();}
  $days=(int)(new DateTimeImmutable($profile['solarDate'],new DateTimeZone('UTC')))->diff(new DateTimeImmutable($local->format('Y-m-d'),new DateTimeZone('UTC')))->format('%r%a');
  foreach(['physical'=>23,'emotional'=>28,'intellectual'=>33] as $key=>$cycle)$rhythms[$key]=round(sin(2*M_PI*$days/$cycle),4);
  // In this studio interpretation, the natal and current day stems constrain the
  // two suitable moods. Time of day and rhythms can only choose within that pair.
  $day=n80_saju_day($pillars['day'],$now);
  [$first,$second,$reading]=[
   ['comfort','focus','함께하는 흐름을 살려'],
   ['energy','comfort','마음을 표현하는 흐름을 살려'],
   ['focus','energy','한 가지를 마무리하는 흐름을 살려'],
   ['calm','focus','속도를 가다듬는 흐름을 살려'],
   ['calm','comfort','익숙한 것에서 힘을 얻는 흐름을 살려'],
  ][$day['relation']];
  $scores=[$first=>0.6,$second=>0.0];
  $rhythmWeights=[
   'energy'=>max(0,$rhythms['physical']), 'calm'=>max(0,-$rhythms['physical']),
   'comfort'=>max(0,-$rhythms['emotional']), 'focus'=>max(0,$rhythms['intellectual']),
  ];
  foreach ($scores as $candidate=>$score) {
   $scores[$candidate]+=($candidate===$base?0.55:0)+0.4*$rhythmWeights[$candidate];
  }
  foreach (['木'=>'energy','火'=>'energy','土'=>'comfort','金'=>'focus','水'=>'calm'] as $element=>$candidate) {
   if (isset($scores[$candidate])) $scores[$candidate]+=0.18*mb_substr_count($elements,$element);
  }
  arsort($scores);
  $rankedMoods=array_keys($scores);$mood=$rankedMoods[0];
 }
 $nextKoreanDay=$now->setTimezone(new DateTimeZone('Asia/Seoul'))->modify('tomorrow midnight');
 $labels=['calm'=>'휴식','energy'=>'활력','focus'=>'집중','comfort'=>'위로'];
 return ['mood'=>$mood,'rankedMoods'=>$rankedMoods,'reading'=>$reading,'label'=>$labels[$mood],'period'=>$period,'localDate'=>$local->format('Y-m-d'),'timezone'=>$local->getTimezone()->getName(),'personal'=>!!$pillars,'pillars'=>$pillars,'birthTimeKnown'=>isset($pillars['hour']),'rhythms'=>$rhythms,'validUntil'=>min($now->modify('+15 minutes')->getTimestamp(),$nextKoreanDay->getTimestamp()),'basis'=>$pillars?'생년월일 · 바이오리듬 · 시간대':'시간대','notice'=>'생년월일·출생시간의 전통 달력 해석과 바이오리듬 주기를 선곡에 참고해요. 직접 고른 분위기가 우선합니다.'];
}
function n80_listening_tags(array $body):array{
 $text=implode(' ',array_filter(array_map(static fn($key)=>is_string($body[$key]??null)?$body[$key]:'',['sunoStyle','sunoStylePrompt','stylePrompt','sunoPrompt','style','mood','songDescription','descriptionBlock'])));
 $rules=['calm'=>'calm|relax|ambient|gentle|soft piano|휴식|잔잔|차분|명상','energy'=>'energetic|upbeat|dance|driving beat|high energy|활기|신나는|댄스|경쾌','focus'=>'instrumental|minimal|lo-fi|lofi|piano solo|집중|연주곡|미니멀','road'=>'road trip|night drive|highway|드라이브|드라이빙|운전','cruise'=>'편안한 운전|여유로운 드라이브|해안 드라이브|easy driving|laid.back cruise|scenic drive|cruising','drive'=>'다(?:이내|이나)믹 드라이빙|신나는 드라이브|질주|driving beat|driving bass|high.octane|power drive','sleep'=>'수면|자장가|오르골|lullaby|sleep music|bedtime|white noise|music box|子守唄|เพลงกล่อมเด็ก','walk'=>'walking|stroll|산책|발걸음','comfort'=>'warm|comfort|healing|tender|emotional ballad|위로|따뜻|포근|치유'];$tags=[];
 foreach($rules as $tag=>$pattern)if(preg_match('/'.$pattern.'/iu',$text))$tags[]=$tag;
 return $tags;
}

/**
 * Match distinct motifs, so a repeated chorus cannot outweigh a closer match.
 * The genre, playable audio, and album order are handled by the listening model.
 */
function n80_listening_mood_scores(array $song,array $body):array{
    $title = trim((string)($song['title'] ?? ''));
    $lyrics = (string)($song['lyrics'] ?? '');
    // Keep sung parentheticals, but omit arrangement notes even when inline.
    $lyrics = preg_replace('~[\[(][^\]()\n]*(?:vocal|verse|chorus|intro|outro|bridge|hook|solo|piano|guitar|drum|synth|instrumental|보컬|연주|후렴)[^\]()\n]*[\])]~iu', ' ', $lyrics) ?? $lyrics;
    $lyrics = str_replace(['’','‘'], "'", $lyrics);
    $title = str_replace(['’','‘'], "'", $title);
    // Use the visible, edited description when present, just as we use the current title and lyrics.
    if (array_key_exists('description',$song)) {
        unset($body['descriptionBlock']);
        $body['songDescription'] = $song['description'];
    }
    $scores = array_fill_keys(n80_listening_tags($body),1);
    static $motifs = [
        'calm' => [
            '~휴식|안식|쉼표|쉬어\s*(?:가|도|갈|요)|잠시\s*쉬|잠(?:시|깐)\s*멈춰|편히\s*(?:쉬|잠)|\b(?:calm|rest easy|unwind|take a break|relax(?:ing)?)\b|ひと休み|พักผ่อน~iu',
            '~숨(?:을|부터)?\s*(?:고르|고른|고를|고르면|돌리|돌려)|눈을\s*(?:감고|감는|감아)|\b(?:breathe slowly|slow down|take a breath)\b|深呼吸|หายใจช้า~iu',
            '~잔잔한|고요한|평온|차분한|자장가|\b(?:still waters|quiet night|gentle breeze|lullaby|peaceful)\b|穏やか|静かな夜|เงียบสงบ~iu',
        ],
        'focus' => [
            '~집중(?!하지\s*못)|몰입|한\s*가지에|\b(?:focus(?:ed)?|concentrate|one thing at a time)\b|集中|จดจ่อ|สมาธิ~iu',
            '~잡념을\s*(?:비우|비워|놓)|생각을\s*정리|마음을\s*가다듬|\b(?:clear my mind|tune out the noise|clear your mind)\b|心を整え|ตั้งสติ~iu',
            '~귀를\s*기울|한\s*(?:획|줄)씩|호흡에\s*맞춰|숨을\s*(?:하나씩\s*)?세[고며어]|한\s*음씩|박자(?:를|에)\s*(?:세며|집중)|\b(?:count the beats|one note at a time|steady rhythm)\b|一音ずつ|ทีละจังหวะ~iu',
        ],
        'energy' => [
            '~활력|활기|힘차게|힘을\s*내|\b(?:energy|energized|power up)\b|元気いっぱい|มีพลัง~iu',
            '~다시\s*(?:일어나|일어서|달려|뛰어)|힘껏\s*(?:달|뛰)|끝까지\s*달|달려(?:가|보자)|뛰어(?:올라|가)|다시\s*(?:시작|살아가)|\b(?:rise again|get back up|run wild|keep running)\b|立ち上が|走り出|ลุกขึ้นอีกครั้ง~iu',
            '~춤(?:을|춰)\s*(?:추|춰|봐)?|소리\s*질러|더\s*소리쳐|더\s*크게\s*외쳐|심장(?:이|은)\s*뛰|\b(?:dance|dancing|turn it up|jump higher|hands up)\b|踊ろう|踊れ|เต้นรำ~iu',
        ],
        'road' => ['~드라이브|드라이빙|운전|고속도로|해안도로|차창|\b(?:night drive|highway|road trip|dashboard)\b|ドライブ|ขับรถ~iu'],
        'cruise' => ['~편안한\s*운전|여유로운\s*드라이브|해안도로를\s*따라|차창\s*(?:밖|너머).{0,14}(?:바람|노을)|\b(?:scenic drive|slow cruise|cruising|coastal drive)\b|海沿いのドライブ|ขับรถชิล~iu'],
        'drive' => ['~다(?:이내|이나)믹\s*드라이빙|신나는\s*드라이브|질주|엔진.{0,6}(?:박동|포효)|\b(?:power drive|full throttle|high.octane|driving beat)\b|疾走|เร้าใจบนถนน~iu'],
        'sleep' => [
            '~자장가|수면\s*음악|잘\s*자요|잘\s*자[,\s]|편히\s*(?:잠|자)|잠이\s*들(?:어|면)|\b(?:lullaby|bedtime|sleep tight|sleep gently|drift off to sleep)\b|子守[歌唄]|おやすみ|กล่อมนอน|ฝันดี~iu',
            '~오르골|백색\s*소음|\b(?:music box|white noise|sleep sounds)\b|オルゴール|กล่องดนตรี~iu',
        ],
        'walk' => ['~산책|발걸음|골목길|걸어가|나란히 걸|\b(?:stroll|footsteps|walking|take a walk)\b|散歩|เดินเล่น~iu'],
        'comfort' => [
            '~^위로$|(?:작은|따뜻한|오늘의|너를 위한)\s*위로|위로(?:가|를|해|의|받|하[는고며]|하고\s*싶)|토닥|다독|\b(?:comfort(?:ing)?|console you)\b|慰め|ปลอบใจ~iu',
            '~(?:네|너의|내가)\s*곁에\s*(?:있을게|머물|서서)|혼자(?:가)?\s*아니|\b(?:by your side|not alone|here for you)\b|そばにいる|ひとりじゃない|ไม่โดดเดี่ยว|อยู่ข้างเธอ~iu',
            '~기대도\s*(?:돼|되|될)|잘\s*버텼|수고했|괜찮아(?:질|져|요|\b)|안아\s*줄게|네\s*편이야|\b(?:lean on me|it\x27s (?:okay|ok)|hold your hand)\b|大丈夫|寄り添|ไม่เป็นไร~iu',
        ],
    ];
    foreach ($motifs as $mood => $patterns) {
        foreach ($patterns as $pattern) {
            $points = 3 * preg_match($pattern,$title) + 2 * preg_match($pattern,$lyrics);
            if ($points > 0) $scores[$mood] = ($scores[$mood] ?? 0) + $points;
        }
    }
    // A road reference alone does not tell us whether a recording is mellow or energetic.
    if (isset($scores['road'])) {
        $weight=$scores['road'];unset($scores['road']);
        $calm=$scores['calm']??0;$energy=$scores['energy']??0;
        if($calm>$energy)$scores['cruise']=($scores['cruise']??0)+$weight;
        if($energy>$calm)$scores['drive']=($scores['drive']??0)+$weight;
    }
    return $scores;
}

// The home reading and the music recommendation both change on the Korean calendar day.
function n80_saju_day(string $natalPillar,DateTimeImmutable $at):array{
 $kst=$at->setTimezone(new DateTimeZone('Asia/Seoul'));
 $date=$kst->format('Y-m-d');
 static $cachedDate=null,$dayStem=null;
 $stems='甲乙丙丁戊己庚辛壬癸';
 if ($cachedDate!==$date) {
  require_once __DIR__.'/personal-calendar-vendor.php';
  $chart=\com\nlf\calendar\Solar::fromYmdHms((int)$kst->format('Y'),(int)$kst->format('n'),(int)$kst->format('j'),12,0,0)->getLunar()->getEightChar();
  $dayStem=mb_strpos($stems,mb_substr($chart->getDay(),0,1));
  $cachedDate=$date;
 }
 $birthStem=mb_strpos($stems,mb_substr($natalPillar,0,1));
 if ($birthStem===false||$dayStem===false) throw new UnexpectedValueException('invalid_calendar_stem');
 return ['date'=>$date,'stem'=>$dayStem,'relation'=>(intdiv($dayStem,2)-intdiv($birthStem,2)+5)%5];
}
function n80_daily_fortune(array $pillars,DateTimeImmutable $at):?array{
 if(empty($pillars['day']))return null;
 $day=n80_saju_day($pillars['day'],$at);
 $readings=[
  ['함께하면 가벼워지는 날','혼자 붙잡고 있던 일에 다른 사람의 시선이 보탬이 될 수 있어요.','오늘 듣고 싶은 곡을 골라 가까운 사람에게 건네 보세요.','부탁하고 싶었던 작은 일 하나를 말로 꺼내 보세요.'],
  ['표현에 힘이 실리는 날','마음속에만 두었던 생각을 밖으로 꺼내기 좋은 흐름이에요.','떠오른 생각을 다듬기 전에 한 문장으로 적어 보세요.','고마웠던 순간 하나를 떠올려 그 사람에게 들려주세요.'],
  ['작은 마무리가 빛나는 날','새 일을 더하기보다 손에 잡힌 일에서 기쁨을 찾기 좋은 날이에요.','오늘 끝낼 수 있는 일 하나를 고르고 첫 단계부터 해 보세요.','미뤄 둔 답장 하나를 보내고 잠깐 숨을 돌려 보세요.'],
  ['속도를 고르는 날','요청이 겹친다면 잠깐 멈춰 무엇을 먼저 할지 골라 보세요.','일정 사이에 좋아하는 노래 한 곡만큼 여백을 남겨 보세요.','오늘 꼭 지키고 싶은 약속 하나에 먼저 시간을 내 보세요.'],
  ['익숙한 것에서 힌트를 얻는 날','전에 들은 말이나 오래된 노래가 오늘은 다르게 다가올 수 있어요.','한동안 듣지 않았던 곡을 다시 틀고 마음에 남는 구절을 찾아보세요.','예전에 적어 둔 메모 한 장을 다시 읽어 보세요.']
 ];
 [$headline,$body,$a,$b]=$readings[$day['relation']];
 return ['date'=>$day['date'],'headline'=>$headline,'body'=>$body,'tip'=>($day['stem']%2)?$a:$b];
}

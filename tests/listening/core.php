<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/deploy/noa-app/engine/personal-listening.php';
function check(bool $ok,string $name):void{if(!$ok)throw new RuntimeException($name);}
$now=new DateTimeImmutable('2026-11-03T00:00:00Z');
$base=['genre'=>'kpop-original','timezone'=>'Asia/Seoul','consent'=>true,'birthDate'=>'1990-06-15','calendar'=>'solar','birthTime'=>'09:30','birthTimezone'=>'Asia/Seoul'];
$p=n80_listening_profile($base,$now);$t=n80_listening_theme($p,$now);check(count($t['pillars'])===4,'four pillars');check(count($t['rhythms'])===3,'three rhythm cycles');check($t['period']==='아침','local time');check(n80_listening_theme($p,$now)===$t,'deterministic');
$p=n80_listening_profile(array_merge($base,['birthTime'=>'']),$now);check(count(n80_listening_theme($p,$now)['pillars'])===3,'unknown birth time not invented');
$p=n80_listening_profile(array_merge($base,['birthDate'=>'2024-01-01','calendar'=>'lunar']),$now);check($p['solarDate']==='2024-02-10','Korean lunar new year');
$p=n80_listening_profile(array_merge($base,['birthDate'=>'2023-02-01','calendar'=>'lunar','leap'=>true]),$now);check($p['solarDate']==='2023-03-22','Korean leap month');
foreach([['birthDate'=>'2024-02-30'],['birthDate'=>'2023-01-01','calendar'=>'lunar','leap'=>true],['birthDate'=>'2099-01-01'],['timezone'=>'bad'],['birthTime'=>'25:00'],['genre'=>'all']] as $bad){try{n80_listening_profile(array_merge($base,$bad),$now);throw new RuntimeException('accepted invalid input');}catch(DomainException $e){}}
$p=n80_listening_profile(array_merge($base,['consent'=>false]),$now);check(!isset($p['birthDate'])&&!isset($p['solarDate']),'consent off erases birth information');check(!n80_listening_theme($p,$now)['personal'],'no consent means time-only');
check(n80_listening_theme(['timezone'=>'America/Los_Angeles'],$now)['localDate']==='2026-11-02','timezone date boundary');
check(n80_listening_tags(['sunoStyle'=>'warm instrumental piano solo'])===['focus','comfort'],'style metadata fallback');
// Hold the listening clock constant and vary only the natal chart.
$moods=[];$pairs=[];
for ($day=1;$day<=10;$day++){
 $profile=n80_listening_profile(array_replace($base,['birthDate'=>sprintf('1990-06-%02d',$day)]),$now);
 $theme=n80_listening_theme($profile,$now);
 check($theme['personal'] && $theme['mood']===$theme['rankedMoods'][0] && count(array_unique($theme['rankedMoods']))===2,'chart-ranked moods');
 $moods[$theme['mood']]=true;$pair=$theme['rankedMoods'];sort($pair);$pairs[implode(',',$pair)]=true;
}
check(count($moods)>1 && count($pairs)===5,'different charts must change the available moods at the same hour');
$p=n80_listening_profile($base,$now);
$today=n80_saju_day($t['pillars']['day'],$now);$later=n80_saju_day($t['pillars']['day'],$now->modify('+2 days'));
check($today['relation']!==$later['relation'],'same chart follows current day');
check(n80_listening_theme($p,new DateTimeImmutable('2026-11-03T14:59:40Z'))['validUntil']===strtotime('2026-11-03T15:00:00Z'),'expire at Korean midnight');
$lunar=n80_listening_profile(array_replace($base,['birthDate'=>'2024-01-01','calendar'=>'lunar']),$now);
$solar=n80_listening_profile(array_replace($base,['birthDate'=>'2024-02-10']),$now);
check(n80_listening_theme($lunar,$now)['rankedMoods']===n80_listening_theme($solar,$now)['rankedMoods'],'same birth in both calendars');
check(n80_listening_theme(['consent'=>false,'solarDate'=>'1990-06-15'],$now)['rankedMoods']===[],'no chart-based mood without consent');
require __DIR__.'/moods.php';
echo "N80_LISTENING_CORE_OK\n";

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
check(n80_listening_tags(['sunoStyle'=>'warm instrumental piano solo'])===['focus','comfort'],'metadata tags');check(n80_listening_tags(['confirmedTitle'=>'warm love'])===[],'title is not mood evidence');
echo "N80_LISTENING_CORE_OK\n";

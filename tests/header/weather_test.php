<?php
declare(strict_types=1);
define('NOA_HEADER_WEATHER_TEST',true);require __DIR__.'/../../bridge/weather.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
check(noa_header_coordinates(['latitude'=>35.1795543,'longitude'=>129.0756416])===[35.18,129.08],'coordinates are rounded before provider calls');
foreach([[],['latitude'=>91,'longitude'=>0],['latitude'=>0,'longitude'=>181],['latitude'=>'bad','longitude'=>0],['latitude'=>INF,'longitude'=>0]] as $input){try{noa_header_coordinates($input);throw new RuntimeException('invalid input accepted');}catch(InvalidArgumentException $e){}}
$now=strtotime('2026-11-04T01:10:00Z');
$data=['properties'=>['timeseries'=>[['time'=>'2026-11-04T01:00:00Z','data'=>['instant'=>['details'=>['air_temperature'=>13.6]],'next_1_hours'=>['summary'=>['symbol_code'=>'clearsky_day']]]]]]];
$summary=noa_header_weather_summary($data,$now);check($summary['temperature']===13.6&&$summary['condition']==='맑음','valid current temperature and condition');
check(strtotime($summary['validUntil'])===$now+900,'short cache lifetime');
$data['properties']['timeseries'][0]['data']['next_1_hours']['summary']['symbol_code']='heavyrainandthunder';check(noa_header_weather_summary($data,$now)['condition']==='뇌우','thunder is not lost in rain description');
try{noa_header_weather_summary($data,$now+10800);throw new RuntimeException('old forecast accepted as current');}catch(RuntimeException $e){check($e->getMessage()==='weather_stale','stale data rejected');}
check(noa_header_place(['address'=>['city'=>'부산광역시','borough'=>'연제구']])==='부산광역시 연제구','local district name');
check(noa_header_place([])==='현재 위치','missing place name does not fabricate a location');
echo "HEADER_WEATHER_VALIDATION_AND_FRESHNESS_OK\n";

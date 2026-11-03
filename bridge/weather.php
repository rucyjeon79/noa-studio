<?php
/** Public, read-only weather gateway. Coordinates are rounded and never saved to member records. */
declare(strict_types=1);
function noa_header_coordinates(array $input): array {
    foreach (['latitude'=>90,'longitude'=>180] as $key=>$limit) {
        if (!isset($input[$key]) || !is_numeric($input[$key]) || !is_finite((float)$input[$key]) || abs((float)$input[$key])>$limit) throw new InvalidArgumentException('invalid_coordinates');
    }
    return [round((float)$input['latitude'],2),round((float)$input['longitude'],2)];
}
function noa_header_weather_summary(array $data, int $now): array {
    $nearest=null;$distance=PHP_INT_MAX;
    foreach (($data['properties']['timeseries']??[]) as $point) {
        $stamp=strtotime($point['time']??'');if ($stamp===false) continue;
        if (abs($stamp-$now)<$distance) {$nearest=$point;$distance=abs($stamp-$now);}
    }
    if (!$nearest || $distance>7200) throw new RuntimeException('weather_stale');
    $temperature=$nearest['data']['instant']['details']['air_temperature']??null;
    if (!is_numeric($temperature) || $temperature < -100 || $temperature > 70) throw new RuntimeException('weather_invalid');
    $symbol=$nearest['data']['next_1_hours']['summary']['symbol_code']??$nearest['data']['next_6_hours']['summary']['symbol_code']??'';
    $base=preg_replace('/_(day|night|polartwilight)$/','',(string)$symbol);
    $condition=match (true) {
        str_contains($base,'thunder')=>'뇌우',str_contains($base,'sleet')=>'진눈깨비',str_contains($base,'snow')=>'눈',
        str_contains($base,'rain')=>'비',$base==='fog'=>'안개',$base==='cloudy'=>'흐림',$base==='partlycloudy'=>'구름 조금',
        in_array($base,['clearsky','fair'],true)=>'맑음',default=>'날씨 확인 중'
    };
    if ($condition==='날씨 확인 중') throw new RuntimeException('weather_condition_missing');
    return ['temperature'=>round((float)$temperature,1),'condition'=>$condition,'forecastAt'=>$nearest['time'],'validUntil'=>gmdate('c',$now+900)];
}
function noa_header_place(array $data): string {
    $a=$data['address']??[];$city=$a['city']??$a['town']??$a['village']??$a['county']??$a['state']??'';
    $district=$a['city_district']??$a['borough']??$a['suburb']??'';
    $parts=array_unique(array_filter([$city,$district],static fn($x)=>is_string($x)&&$x!==''));
    return $parts ? implode(' ', $parts) : '현재 위치';
}
function noa_header_http(string $url, array $headers=[]): array {
    $ch=curl_init($url);$responseHeaders=[];
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>9,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_USERAGENT=>'NOA-STUDIO-Weather/1.0 (https://noastudio.ai.kr/noa-about.php)',CURLOPT_HTTPHEADER=>array_merge(['Accept: application/json'],$headers),
        CURLOPT_HEADERFUNCTION=>static function($handle,$line) use (&$responseHeaders) {$parts=explode(':',$line,2);if(count($parts)===2)$responseHeaders[strtolower(trim($parts[0]))]=trim($parts[1]);return strlen($line);}]);
    $body=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if (!is_string($body)||strlen($body)>2000000) throw new RuntimeException('provider_unavailable');
    if ($status===304) return ['status'=>304,'headers'=>$responseHeaders];
    if (!in_array($status,[200,203],true)) throw new RuntimeException('provider_unavailable');
    $data=json_decode($body,true,32,JSON_THROW_ON_ERROR);if(!is_array($data))throw new RuntimeException('provider_invalid');
    return ['status'=>$status,'headers'=>$responseHeaders,'data'=>$data];
}
function noa_header_cache_read(string $file): ?array { $raw=@file_get_contents($file);if(!is_string($raw))return null;$value=json_decode($raw,true);return is_array($value)?$value:null; }
function noa_header_cache_write(string $file,array $data): void {file_put_contents($file,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX);@chmod($file,0600);}
/** Lock and timestamp make provider limits apply to the entire site, across PHP workers. */
function noa_header_provider_gate(string $folder,string $name): void {
    $f=fopen($folder.'/'.$name.'.rate','c+');if(!$f||!flock($f,LOCK_EX|LOCK_NB))throw new RuntimeException('provider_busy');
    try {$last=(float)stream_get_contents($f);if(microtime(true)-$last<1.1)throw new RuntimeException('provider_busy');ftruncate($f,0);rewind($f);fwrite($f,(string)microtime(true));}finally{flock($f,LOCK_UN);fclose($f);}
}
function noa_header_weather_lookup(array $coordinates): array {
    [$lat,$lon]=$coordinates;$folder=sys_get_temp_dir().'/noa-header-weather-v1';
    if(!is_dir($folder)&&!@mkdir($folder,0700,true)&&!is_dir($folder))throw new RuntimeException('weather_cache_unavailable');
    $key=hash('sha256',$lat.','.$lon);$file=$folder.'/'.$key.'.json';$cached=noa_header_cache_read($file);$now=time();
    if($cached&&($cached['expires']??0)>$now){$summary=noa_header_weather_summary($cached['data'],$now);}
    else {
        noa_header_provider_gate($folder,'weather');
        $headers=isset($cached['modified'])?['If-Modified-Since: '.$cached['modified']]:[];
        $reply=noa_header_http('https://api.met.no/weatherapi/locationforecast/2.0/compact?lat='.$lat.'&lon='.$lon,$headers);
        if($reply['status']===304&&!$cached)throw new RuntimeException('weather_cache_missing');
        $data=$reply['data']??$cached['data'];$summary=noa_header_weather_summary($data,$now);
        $cached=['data'=>$data,'expires'=>max($now+900,strtotime($reply['headers']['expires']??'')?:0),'modified'=>$reply['headers']['last-modified']??$cached['modified']??gmdate('D, d M Y H:i:s',$now).' GMT'];
        noa_header_cache_write($file,$cached);
    }
    $placeFile=$folder.'/'.$key.'.place.json';$place=noa_header_cache_read($placeFile);
    if(!$place||($place['expires']??0)<$now) {
        try {
            noa_header_provider_gate($folder,'geocoder');
            $geo=noa_header_http('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='.$lat.'&lon='.$lon.'&zoom=12&addressdetails=1&accept-language=ko');
            $place=['name'=>noa_header_place($geo['data']),'expires'=>$now+2592000];noa_header_cache_write($placeFile,$place);
        } catch(Throwable $e) {$place=['name'=>'현재 위치'];}
    }
    return ['ok'=>true,'location'=>$place['name'],...$summary];
}
if (!defined('NOA_HEADER_WEATHER_TEST')) {
    header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
    try {
        if(($_SERVER['REQUEST_METHOD']??'')!=='POST'){http_response_code(405);header('Allow: POST');throw new InvalidArgumentException('method_not_allowed');}
        $origin=$_SERVER['HTTP_ORIGIN']??'';
        if(($origin!==''&&$origin!=='https://noastudio.ai.kr')||($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site'){http_response_code(403);throw new InvalidArgumentException('same_origin_required');}
        $body=file_get_contents('php://input',false,null,0,1025);if(strlen($body)>1024)throw new InvalidArgumentException('request_too_large');
        $input=json_decode($body,true,8,JSON_THROW_ON_ERROR);if(!is_array($input))throw new InvalidArgumentException('invalid_coordinates');
        $result=noa_header_weather_lookup(noa_header_coordinates($input));
        echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    } catch(InvalidArgumentException|JsonException $e){if(http_response_code()<400)http_response_code(400);echo json_encode(['ok'=>false,'error'=>'invalid_request']);}
    catch(Throwable $e){http_response_code(503);header('Retry-After: 60');echo json_encode(['ok'=>false,'error'=>'weather_unavailable']);}
}

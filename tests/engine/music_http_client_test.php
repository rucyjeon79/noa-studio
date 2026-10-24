<?php
declare(strict_types=1);
/** Isolate the actual fixed-origin function; no DB/bootstrap, policy or lease. */
namespace N80MusicHttpMock {
 function function_exists(string $name):bool{return $name==='curl_init'?($GLOBALS['curl_mock_available']??true):\function_exists($name);}
 function ini_get(string $name):string{return $name==='allow_url_fopen'?'0':(string)\ini_get($name);}
 function curl_init(string $url){$GLOBALS['curl_mock_url']=$url;return (object)['test'=>true];}
 function curl_setopt_array($handle,array $options):bool{$GLOBALS['curl_mock_options']=$options;return true;}
 function curl_exec($handle):bool {
  foreach($GLOBALS['curl_mock_chunks']??['body'] as $chunk){$write=$GLOBALS['curl_mock_options'][CURLOPT_WRITEFUNCTION];
   if($write($handle,$chunk)!==strlen($chunk)){$GLOBALS['curl_mock_errno']=23;return false;}}
  return ($GLOBALS['curl_mock_errno']??0)===0;
 }
 function curl_errno($handle):int{return $GLOBALS['curl_mock_errno']??0;}
 function curl_getinfo($handle,int $option):int{return $GLOBALS['curl_mock_status']??200;}
 function curl_close($handle):void{$GLOBALS['curl_mock_closed']=true;}
}
namespace {
 $source=file_get_contents(dirname(__DIR__,2).'/deploy/noa-app/engine/music-availability.php');
 // token_get_all keeps braces in quoted strings/comments out of the brace count.
 $tokens=token_get_all($source);$function='';$collect=false;$depth=0;$entered=false;
 foreach($tokens as $i=>$token){
  if(!$collect&&is_array($token)&&$token[0]===T_FUNCTION){
   $next=$i+1;while(isset($tokens[$next])&&is_array($tokens[$next])&&$tokens[$next][0]===T_WHITESPACE)$next++;
   if(isset($tokens[$next])&&is_array($tokens[$next])&&$tokens[$next][1]==='n80_music_public_get')$collect=true;
  }
  if(!$collect)continue;$text=is_array($token)?$token[1]:$token;$function.=$text;
  if(!is_array($token)&&$token==='{'){$depth++;$entered=true;}
  if(!is_array($token)&&$token==='}'&&--$depth===0&&$entered)break;
 }
 if($function===''||!$entered||$depth!==0)throw new \RuntimeException('fixed_client_function_missing');
 $names=['CURLOPT_HTTPGET','CURLOPT_FOLLOWLOCATION','CURLOPT_MAXREDIRS','CURLOPT_PROTOCOLS','CURLOPT_REDIR_PROTOCOLS',
  'CURLPROTO_HTTPS','CURLOPT_SSL_VERIFYPEER','CURLOPT_SSL_VERIFYHOST','CURLOPT_CONNECTTIMEOUT','CURLOPT_TIMEOUT',
  'CURLOPT_NOSIGNAL','CURLOPT_HEADER','CURLOPT_RETURNTRANSFER','CURLOPT_USERAGENT','CURLOPT_HTTPHEADER','CURLOPT_WRITEFUNCTION','CURLINFO_RESPONSE_CODE'];
 $next=10000;foreach($names as $name)if(!defined($name))define($name,$next++);
 eval('namespace N80MusicHttpMock;use \\RuntimeException;use \\InvalidArgumentException;'.$function);
 $checks=0;
 function http_check(bool $ok,string $name):void{global $checks;$checks++;if(!$ok)throw new \RuntimeException($name);}
 function mock_reset(array $chunks=['body'],int $status=200,int $errno=0):void{
  $GLOBALS['curl_mock_available']=true;$GLOBALS['curl_mock_chunks']=$chunks;$GLOBALS['curl_mock_status']=$status;
  $GLOBALS['curl_mock_errno']=$errno;$GLOBALS['curl_mock_closed']=false;
 }
 function expect_error(string $error,callable $call):void{
  try{$call();throw new \RuntimeException('expected_failure_missing');}
  catch(\RuntimeException $e){http_check($e->getMessage()===$error,'safe_error_enum');}
 }
 mock_reset();$r=\N80MusicHttpMock\n80_music_public_get('catalog','');
 http_check($r===['status'=>200,'body'=>'body'],'curl_operates_when_fopen_disabled');
 http_check($GLOBALS['curl_mock_url']==='https://noastudio.ai.kr/noa-music.php','fixed_catalog_origin');
 $o=$GLOBALS['curl_mock_options'];
 http_check($o[CURLOPT_SSL_VERIFYPEER]===true&&$o[CURLOPT_SSL_VERIFYHOST]===2,'tls_verification');
 http_check($o[CURLOPT_FOLLOWLOCATION]===false&&$o[CURLOPT_MAXREDIRS]===0,'no_redirects');
 http_check($o[CURLOPT_PROTOCOLS]===CURLPROTO_HTTPS&&$o[CURLOPT_REDIR_PROTOCOLS]===CURLPROTO_HTTPS,'https_protocols_only');
 http_check($o[CURLOPT_CONNECTTIMEOUT]===8&&$o[CURLOPT_TIMEOUT]===25,'bounded_timeouts');
 http_check(in_array('X-N80-Availability-Check: 1',$o[CURLOPT_HTTPHEADER],true),'no_play_count_header');
 http_check($GLOBALS['curl_mock_closed'],'handle_closed');
 mock_reset(['x'],200);\N80MusicHttpMock\n80_music_public_get('detail',"key&redirect=https://evil.invalid/\r\nCookie: injected");
 http_check(str_starts_with($GLOBALS['curl_mock_url'],'https://noastudio.ai.kr/noa-music-detail.php?key=')
   &&!str_contains($GLOBALS['curl_mock_url'],"\r")&&!str_contains($GLOBALS['curl_mock_url'],'&redirect='),'key_cannot_change_origin_or_headers');
 mock_reset([str_repeat('a',4096)],206);$r=\N80MusicHttpMock\n80_music_public_get('audio','single:fixture:01');
 http_check(strlen($r['body'])===4096&&in_array('Range: bytes=0-4095',$GLOBALS['curl_mock_options'][CURLOPT_HTTPHEADER],true),'bounded_audio_range');
 mock_reset([str_repeat('a',4096),'x'],206);expect_error('public_read_too_large',fn()=>\N80MusicHttpMock\n80_music_public_get('audio','key'));
 mock_reset([str_repeat('a',4194305)]);expect_error('public_read_too_large',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 mock_reset([],302);expect_error('public_http_non_success',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 mock_reset([],200,60);expect_error('public_tls_failed',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 mock_reset([],0,28);expect_error('public_read_timeout',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 mock_reset([],0,7);expect_error('public_network_failed',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 $GLOBALS['curl_mock_available']=false;expect_error('public_url_access_disabled',fn()=>\N80MusicHttpMock\n80_music_public_get('catalog',''));
 try{\N80MusicHttpMock\n80_music_public_get('https://evil.invalid/','');throw new \RuntimeException('unsupported_kind_accepted');}
 catch(\InvalidArgumentException $e){http_check($e->getMessage()==='unsupported_public_read','no_caller_url');}
 $live=false;
 if(getenv('N80_MUSIC_HTTP_LIVE_TEST')==='1'){
  // Explicit candidate check: caller cannot configure an alternative host/URL.
  http_check(\function_exists('curl_init'),'native_curl_extension_required');
  http_check(!filter_var(\ini_get('allow_url_fopen'),FILTER_VALIDATE_BOOLEAN),'invoke_php_with_url_fopen_zero');
  eval($function);$catalog=n80_music_public_get('catalog','');
  http_check($catalog['status']===200&&($GLOBALS['n80_music_http_client']??null)==='curl','native_fixed_public_catalog');
  http_check(preg_match('/const records=(.*?);\s*const collections=/s',$catalog['body'],$m)===1,'live_catalog_contract');
  $rows=json_decode($m[1],true);$key=null;foreach($rows as $row)if(isset($row['key'])
    &&($row['audio']??null)==='https://noastudio.ai.kr/noa-app/jukebox/stream.php?key='.rawurlencode($row['key']).'&type=audio'){$key=$row['key'];break;}
  http_check(is_string($key),'public_audio_record_available');
  $detail=n80_music_public_get('detail',$key);$decoded=json_decode($detail['body'],true);
  http_check($detail['status']===200&&($decoded['key']??null)===$key,'native_fixed_public_detail');
  $audio=n80_music_public_get('audio',$key);
  http_check(in_array($audio['status'],[200,206],true)&&strlen($audio['body'])>0&&strlen($audio['body'])<=4096,'native_fixed_public_audio');
  $live=true;
 }
 echo json_encode(['ok'=>true,'assertions'=>$checks,'liveFixedOriginVerified'=>$live,'databaseWrites'=>0,'businessAck'=>false]).PHP_EOL;
}

<?php
declare(strict_types=1);
/** Restrict the installed GnuBoard social adapter; credentials stay in native private configuration. */
function nsp_provider(mixed $value):?string{
 if(!is_string($value))return null;$p=strtolower($value);return in_array($p,['google','kakao'],true)?$p:null;
}
function nsp_return(mixed $value):string{
 if(!is_string($value)||strlen($value)>2048)return '/';
 $v=rawurldecode($value);if(preg_match('/[\x00-\x20\x7f\\\\]/',$v)||!str_starts_with($v,'/')||str_starts_with($v,'//'))return '/';return $v;
}
function nsp_status(array $config):array{
 return ['google'=>['label'=>'Google','ready'=>!empty($config['cf_google_clientid'])&&!empty($config['cf_google_secret'])],
 'kakao'=>['label'=>'카카오','ready'=>!empty($config['cf_kakao_rest_key'])&&!empty($config['cf_kakao_client_secret'])]];
}
function nsp_verified(mixed $provider):bool{
 if(!nsp_provider($provider)||!function_exists('social_session_exists_check'))return false;
 $profile=social_session_exists_check();return is_object($profile)&&isset($profile->identifier)&&is_scalar($profile->identifier)&&(string)$profile->identifier!=='';
}
function nsp_decide(string $script,string $method,array $request,bool $logged,bool $verified):string{
 $file=basename($script);$mode=$request['w']??'';
 if(in_array($file,['register.php','register_form.php','register_form_update.php'],true)&&!str_contains($script,'/plugin/social/')){
  if($file!=='register.php'&&$logged&&$mode==='u')return 'allow';
  return $method==='GET'?'signup':'deny';
 }
 if(str_contains($script,'/plugin/social/')&&in_array($file,['register_member.php','register_member_update.php'],true))return $verified?'allow':'deny';
 if(str_contains($script,'/plugin/social/')||in_array($file,['login.php','login_check.php'],true)){
  foreach(['provider','hauth_start','hauth_done','hauth.start','hauth.done']as $k)if(isset($request[$k])&&!nsp_provider($request[$k]))return 'deny';
 }
 if($file==='login.php'&&$method==='GET'&&empty($request['provider'])&&($request['legacy']??'')!=='1')return 'login';
 return 'allow';
}

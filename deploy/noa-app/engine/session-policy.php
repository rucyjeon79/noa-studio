<?php
declare(strict_types=1);
/** N80 owns continuity; native member verification, OAuth and logout remain authoritative. */
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function n80_session_idle_seconds():int{return 7*86400;}
function n80_session_use_popup():bool{return false;}
function n80_session_import(string $source,string $destination,string $id,int $now):void {
 if(!preg_match('/^[a-zA-Z0-9,-]{16,128}$/D',$id)||$source===$destination)return;
 $old=$source.'/sess_'.$id;$new=$destination.'/sess_'.$id;
 if(file_exists($new)||!is_file($old)||is_link($old)||filemtime($old)<$now-10800)return;
 // A completed import must never resurrect the old login after native logout.
 $marker=$destination.'/import-'.hash('sha256',$id);
 if(is_link($marker))throw new RuntimeException('unsafe_session_marker');
 $lock=fopen($marker,'c+');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('session_import_lock');
 try{
  if(fstat($lock)['size']>0||file_exists($new))return;
  $in=fopen($old,'rb');if(!$in)return;
  try{
   if(!flock($in,LOCK_SH))throw new RuntimeException('session_source_lock');
   $info=fstat($in);if($info['mtime']<$now-10800||$info['size']>2097152)return;
   $out=fopen($new,'x+b');if(!$out)throw new RuntimeException('session_import_create');
   try{chmod($new,0600);if(stream_copy_to_stream($in,$out)!==$info['size']||!fflush($out))throw new RuntimeException('session_import_write');}
   catch(Throwable $e){unlink($new);throw $e;}finally{fclose($out);}
   touch($new,$info['mtime']);if(fwrite($lock,'1')!==1||!fflush($lock))throw new RuntimeException('session_import_marker');chmod($marker,0600);
  }finally{flock($in,LOCK_UN);fclose($in);}
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function n80_session_cookie_options(array $params,bool $authenticated,bool $logout,bool $secure,int $now,string $sameSite):array {
 return ['expires'=>$logout?$now-3600:($authenticated?$now+n80_session_idle_seconds():0),'path'=>$params['path']?:'/',
  'domain'=>$params['domain']??'','secure'=>$secure,'httponly'=>true,'samesite'=>$secure&&strtolower($sameSite)==='none'?'None':'Lax'];
}
function n80_session_response_cookie():void {
 $name=session_name();$id=session_id();$logout=(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)==='/bbs/logout.php');
 if($id===''&&!$logout)return;
 $secure=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';
 $options=n80_session_cookie_options(session_get_cookie_params(),!empty($_SESSION['ss_mb_id']),$logout,$secure,time(),$GLOBALS['g5']['session_cookie_samesite']??'lax');
 // The native SameSite adapter appends duplicate session cookies. Keep unrelated cookies intact.
 $cookies=[];foreach(headers_list() as $header)if(stripos($header,'Set-Cookie:')===0&&!preg_match('/^Set-Cookie:\\s*'.preg_quote($name,'/').'=/i',$header))$cookies[]=$header;
 header_remove('Set-Cookie');foreach($cookies as $header)header($header,false);
 setcookie($name,$logout?'':$id,$options);
}
function n80_session_bootstrap(?string $directory=null):void {
 if(session_status()!==PHP_SESSION_NONE)throw new LogicException('session_bootstrap_order');
 if(ini_get('session.save_handler')!=='files')throw new RuntimeException('unsupported_session_handler');
 $directory??=dirname(__DIR__,3).'/noa-session-private';
 if(is_link($directory))throw new RuntimeException('unsafe_session_directory');
 if(!is_dir($directory)&&!@mkdir($directory,0700)&&!is_dir($directory))throw new RuntimeException('session_directory_failed');
 if(realpath($directory)!==$directory)throw new RuntimeException('unsafe_session_directory');
 $source=session_save_path()?:sys_get_temp_dir();
 if(str_contains($source,';'))throw new RuntimeException('unsupported_session_layout');
 n80_session_import($source,$directory,(string)($_COOKIE[session_name()]??''),time());
 session_save_path($directory);ini_set('session.gc_maxlifetime',(string)n80_session_idle_seconds());ini_set('session.use_strict_mode','1');
 header_register_callback('n80_session_response_cookie');
}

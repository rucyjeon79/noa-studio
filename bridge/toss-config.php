<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function nt_config_path():string{return dirname(__DIR__,2).'/noa-private/toss.php';}
function nt_config():array{
 if(defined('NOA_TOSS_TEST_HARNESS')&&PHP_SAPI==='cli'&&isset($GLOBALS['nt_test_config']))return $GLOBALS['nt_test_config'];
 $p=nt_config_path();$v=is_file($p)&&!is_link($p)?require $p:[];
 return is_array($v)?$v:[];
}
function nt_ready(array $c):bool{
 $mode=$c['mode']??'';
 return !empty($c['enabled'])&&in_array($mode,['test','live'],true)
  &&preg_match('/^'.$mode.'_ck_[A-Za-z0-9_-]+$/D',$c['clientKey']??'')===1
  &&preg_match('/^'.$mode.'_sk_[A-Za-z0-9_-]+$/D',$c['secretKey']??'')===1
  &&preg_match('/^[A-Za-z0-9_-]{1,100}$/D',$c['mid']??'')===1
  &&preg_match('/^[a-fA-F0-9]{64}$/D',$c['webhookSecret']??'')===1&&($mode!=='live'||!empty($c['contractApproved']));
}
function nt_public_config(array $c):array{return ['provider'=>'토스페이먼츠','ready'=>nt_ready($c),'mode'=>$c['mode']??'disabled','clientKey'=>nt_ready($c)?$c['clientKey']:null,'methods'=>['CARD','KAKAOPAY']];}
function nt_save_config(array $input):void{
 $old=nt_config();$mode=$input['mode']??'test';if(!in_array($mode,['test','live'],true))throw new InvalidArgumentException('invalid_configuration');
 $next=['mode'=>$mode,'enabled'=>!empty($input['enabled']),'contractApproved'=>!empty($input['contractApproved'])];
 foreach(['clientKey','secretKey','mid','webhookSecret']as $k){$v=trim((string)($input[$k]??''));if($v===''&&($old['mode']??'')===$mode)$v=$old[$k]??'';if(strlen($v)>500||str_contains($v,"\0"))throw new InvalidArgumentException('invalid_configuration');$next[$k]=$v;}
 if($next['enabled']&&!nt_ready($next))throw new DomainException('configuration_incomplete');
 $path=nt_config_path();$dir=dirname($path);if(is_link($dir)||is_link($path))throw new RuntimeException('configuration_storage_unavailable');
 if(!is_dir($dir)&&!mkdir($dir,0700))throw new RuntimeException('configuration_storage_unavailable');
 $root=realpath(dirname(__DIR__));$actual=realpath($dir);if(!$actual||!$root||str_starts_with($actual.'/',rtrim($root,'/').'/'))throw new RuntimeException('private_storage_required');
 $temp=$dir.'/.toss-'.bin2hex(random_bytes(12));$h=fopen($temp,'x');if(!$h)throw new RuntimeException('configuration_storage_unavailable');
 try{chmod($temp,0600);$body="<?php\nreturn ".var_export($next,true).";\n";if(fwrite($h,$body)!==strlen($body))throw new RuntimeException('configuration_storage_unavailable');fflush($h);fclose($h);$h=null;if(!rename($temp,$path))throw new RuntimeException('configuration_storage_unavailable');if(function_exists('opcache_invalidate'))opcache_invalidate($path,true);}finally{if(is_resource($h))fclose($h);if(is_file($temp))unlink($temp);}
}

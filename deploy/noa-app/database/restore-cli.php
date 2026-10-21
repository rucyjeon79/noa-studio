<?php
/** Operational restore requires a reviewed admin-created plan and a separate CLI approval. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
$options=getopt('',['plan:','approve-sha256:','actor:','maintenance-confirmed']);
if(empty($options['plan'])||empty($options['approve-sha256'])||empty($options['actor'])||!array_key_exists('maintenance-confirmed',$options)){fwrite(STDERR,"Required: --plan=ID --approve-sha256=REVIEWED_HASH --actor=ADMIN_ID --maintenance-confirmed\n");exit(2);}
$_SERVER['REQUEST_METHOD']='CLI';$_SERVER['REQUEST_URI']='/noa-db-cli';$_SERVER['SERVER_NAME']='noastudio.ai.kr';$_SERVER['HTTP_HOST']='noastudio.ai.kr';$_SERVER['REMOTE_ADDR']='127.0.0.1';
ob_start();require dirname(__DIR__,2).'/common.php';ob_end_clean();require __DIR__.'/core.php';
if(!hash_equals((string)($config['cf_admin']??''),(string)$options['actor'])){fwrite(STDERR,"Approved superadministrator required\n");exit(2);}
$member=['mb_id'=>$options['actor']];$process=null;$safety=null;$configPath=null;$errPath=null;$outPath=null;$lock=null;$exitCode=0;
try {
    $planId=nd_id((string)$options['plan']);$path=nd_private().'/restore-plan-'.$planId.'.json';if(is_link($path))throw new RuntimeException('plan_symlink');
    $raw=file_get_contents($path);if(!hash_equals(hash('sha256',$raw),(string)$options['approve-sha256']))throw new RuntimeException('approval_hash_mismatch');
    $plan=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(($plan['expiresAt']??0)<time()||isset($plan['executedAt']))throw new RuntimeException('plan_expired_or_used');
    $backup=nd_manifest($plan['backupId']);if(!hash_equals($backup['sha256'],$plan['backupSha256']))throw new RuntimeException('backup_changed');
    $db=nd_db();$fresh=nd_restore_plan($db,$backup);if($fresh['plan']['current']!==$plan['current'])throw new RuntimeException('affected_tables_changed_replan');
    $freshPath=nd_private().'/restore-plan-'.$fresh['plan']['id'].'.json';unlink($freshPath);
    // A new verified whole-DB recovery point is mandatory before any destructive command.
    $safety=nd_backup($db,null);$lock=nd_lock();if(!hash_equals(hash_file('sha256',$path),(string)$options['approve-sha256']))throw new RuntimeException('plan_changed');$running=$plan;$running['executionStartedAt']=time();file_put_contents($path,json_encode($running,JSON_THROW_ON_ERROR),LOCK_EX);nd_audit('restore','approved',['plan'=>$planId,'backup'=>$backup['id'],'approvalSha256'=>$options['approve-sha256'],'recoveryBackup'=>$safety['id']]);
    if(!function_exists('proc_open'))throw new RuntimeException('mysql_cli_unavailable');
    $bin=null;foreach(['/usr/bin/mysql','/usr/local/bin/mysql'] as $candidate)if(is_executable($candidate)){$bin=$candidate;break;}if(!$bin)throw new RuntimeException('mysql_cli_unavailable');
    $escape=static fn($s)=>'"'.str_replace(["\\",'"',"\n","\r"],["\\\\",'\\"','\\n','\\r'],(string)$s).'"';
    $oldMask=umask(0077);$configPath=nd_private().'/restore-'.$planId.'.cnf';$outPath=nd_private().'/restore-'.$planId.'.out';$errPath=nd_private().'/restore-'.$planId.'.err';
    $f=fopen($configPath,'xb');if(!$f)throw new RuntimeException('private_config_failed');fwrite($f,"[client]\nhost=".$escape(G5_MYSQL_HOST)."\nuser=".$escape(G5_MYSQL_USER)."\npassword=".$escape(G5_MYSQL_PASSWORD)."\ndefault-character-set=utf8mb4\n");fclose($f);
    $process=proc_open([$bin,'--defaults-extra-file='.$configPath,'--binary-mode','--database='.G5_MYSQL_DB],[0=>['file',nd_private().'/'.$backup['id'].'.sql','r'],1=>['file',$outPath,'w'],2=>['file',$errPath,'w']],$pipes,null,null,['bypass_shell'=>true]);umask($oldMask);
    if(!is_resource($process))throw new RuntimeException('restore_process_failed');$started=time();
    do{$state=proc_get_status($process);if(!$state['running'])break;if(time()-$started>120){proc_terminate($process);throw new RuntimeException('restore_timeout_use_recovery_backup');}usleep(100000);}while(true);
    $exit=$state['exitcode'];proc_close($process);$process=null;if($exit!==0)throw new RuntimeException('restore_failed_use_recovery_backup');
    $verify=nd_db();foreach($backup['tables'] as $t=>$count)if((int)nd_rows($verify,'SELECT COUNT(*) AS n FROM `'.$t.'`')[0]['n']!==$count)throw new RuntimeException('restore_count_mismatch_use_recovery_backup');
    $plan['executedAt']=time();$plan['recoveryBackup']=$safety['id'];file_put_contents($path,json_encode($plan,JSON_THROW_ON_ERROR),LOCK_EX);chmod($path,0600);
    nd_audit('restore','ok',['plan'=>$planId,'recoveryBackup'=>$safety['id'],'verifiedTables'=>count($backup['tables'])]);echo "Restore complete; verified table counts. Recovery backup: ".$safety['id']."\n";
}catch(Throwable $e){try{nd_audit('restore','error',['type'=>get_class($e),'code'=>$e->getCode(),'reason'=>$e instanceof PDOException?'database_error':$e->getMessage(),'recoveryBackup'=>$safety['id']??null]);}catch(Throwable $ignored){}fwrite(STDERR,'Restore stopped: '.($e instanceof PDOException?'database_error':$e->getMessage()).'; recovery backup: '.($safety['id']??'none')."\n");$exitCode=1;
}finally{if(is_resource($process)){proc_terminate($process);proc_close($process);}if($configPath&&is_file($configPath))unlink($configPath);if($outPath&&is_file($outPath))unlink($outPath);if(is_resource($lock)){flock($lock,LOCK_UN);fclose($lock);}}

exit($exitCode);

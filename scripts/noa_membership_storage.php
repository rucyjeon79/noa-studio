<?php
declare(strict_types=1);
function nrm_table_hash(string $table):array{
 if(!preg_match('/^[A-Za-z0-9_]+$/D',$table))throw new RuntimeException('unsafe_table');
 $r=ns_q('SELECT * FROM `'.$table.'`');$hashes=[];while($row=sql_fetch_array($r)){ksort($row);$hashes[]=hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));if(count($hashes)>100000)throw new RuntimeException('bounded_backup_exceeded');}sort($hashes,SORT_STRING);return ['rows'=>count($hashes),'sha256'=>hash('sha256',implode("\n",$hashes))];
}
function nrm_engine(string $table):string{return (string)(ns_one('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='.ns_e($table))['ENGINE']??'');}
function nrm_backup_convert(array $tables):array{
   $suffix=gmdate('YmdHis').'_'.bin2hex(random_bytes(3));$backups=[];
   foreach($tables as $key=>$table){$name=$table['name'];$backup='noa_bak_'.$suffix.'_'.str_replace('_table','',$key);ns_q('CREATE TABLE `'.$backup.'` LIKE `'.$name.'`');$backups[$key]=['source'=>$name,'backup'=>$backup];}
   $locks=[];foreach($backups as $b){$locks[]='`'.$b['source'].'` WRITE';$locks[]='`'.$b['backup'].'` WRITE';}ns_q('LOCK TABLES '.implode(',',$locks));
   try{
    foreach($backups as &$b){ns_q('INSERT INTO `'.$b['backup'].'` SELECT * FROM `'.$b['source'].'`');$before=nrm_table_hash($b['source']);$copied=nrm_table_hash($b['backup']);if($before!==$copied)throw new RuntimeException('backup_readback_mismatch');$b['proof']=$copied;}
    unset($b);
    foreach(['member_table','point_table']as $key){$name=$backups[$key]['source'];if(strtoupper($tables[$key]['engine'])!=='INNODB')ns_q('ALTER TABLE `'.$name.'` ENGINE=InnoDB');if(nrm_table_hash($name)!==$backups[$key]['proof'])throw new RuntimeException('engine_conversion_integrity_mismatch');}
   }finally{ns_q('UNLOCK TABLES');}
   // Restore rehearsal uses a newly created, uniquely named table in this same private DB.
   foreach($backups as &$b){$check=$b['backup'].'_check';ns_q('CREATE TABLE `'.$check.'` LIKE `'.$b['backup'].'`');ns_q('INSERT INTO `'.$check.'` SELECT * FROM `'.$b['backup'].'`');if(nrm_table_hash($check)!==$b['proof'])throw new RuntimeException('restore_rehearsal_mismatch');$b['restoreVerified']=true;ns_q('DROP TABLE `'.$check.'`');}unset($b);
   foreach(['member_table','point_table']as $key)if(strtoupper(nrm_engine($tables[$key]['name']))!=='INNODB')throw new RuntimeException('transactional_engine_required');
   return $backups;
}

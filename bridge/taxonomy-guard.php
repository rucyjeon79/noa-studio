<?php
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/taxonomy-store.php';
/** Order independent row fingerprints for every preexisting table; never emits rows. */
function nt_legacy_guard(PDO $db):array{
 $new=array_keys(require __DIR__.'/taxonomy-schema.php');$tables=$db->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")->fetchAll(PDO::FETCH_COLUMN);$out=[];$buffered=$db->getAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY);$db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,false);
 try{foreach(array_diff($tables,$new)as $table){if(!preg_match('/^[A-Za-z0-9_]+$/D',$table))throw new RuntimeException('table_identifier');$q=$db->query('SELECT * FROM `'.$table.'`');$sum=array_fill(0,8,0);$count=0;while($r=$q->fetch(PDO::FETCH_NUM)){$h=hash_init('sha256');foreach($r as $v)hash_update($h,$v===null?'N;':'V'.strlen((string)$v).':'.$v.';');$parts=unpack('N8',hash_final($h,true));foreach($parts as $i=>$v)$sum[$i-1]=($sum[$i-1]+$v)&0xffffffff;$count++;}$q->closeCursor();$out[$table]=['rows'=>$count,'checksum'=>$sum];}}finally{$db->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,$buffered);}return $out;
}
function nt_inventory(PDO $db):array{
 $run=ny_latest($db);return ['mysql'=>$db->query('SELECT VERSION()')->fetchColumn(),'tables'=>(int)$db->query('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')->fetchColumn(),'catalogSongs'=>count(ny_songs($db,ny_batch($db))),'collection'=>$run['run_id']??null,'taxonomyInstalled'=>nt_ready($db)];
}
/** Diagnose configuration changes against our own verified private backup only.
 * Returns column NAMES, never values, passwords, SQL, or arbitrary file paths. */
function nt_backup_config_changes(PDO $db,array $receipt):array{
 if(!preg_match('/^[a-f0-9]{32}$/D',$receipt['id']??'')||!preg_match('/^[a-f0-9]{64}$/D',$receipt['sha256']??''))throw new RuntimeException('backup_receipt');
 $path=dirname(G5_PATH).'/noa-db-private/'.$receipt['id'].'.sql';if(is_link($path)||hash_file('sha256',$path)!==$receipt['sha256'])throw new RuntimeException('backup_integrity');$old=null;$f=fopen($path,'rb');
 try{while(($line=fgets($f))!==false){if(!str_starts_with($line,'INSERT INTO `g5_config` '))continue;if($old!==null)throw new RuntimeException('config_row_count');if(!preg_match('/^INSERT INTO `g5_config` \((.*?)\) VALUES \((.*)\);\n$/D',$line,$m))throw new RuntimeException('config_backup_format');preg_match_all('/`([A-Za-z0-9_]+)`/',$m[1],$columns);preg_match_all("/CONVERT\\(X'([0-9a-f]*)' USING utf8mb4\\)|X'([0-9a-f]*)'|(NULL)/",$m[2],$values,PREG_SET_ORDER);if(count($columns[1])!==count($values))throw new RuntimeException('config_columns');$old=[];foreach($columns[1] as $i=>$col){$v=$values[$i];$old[$col]=isset($v[3])&&$v[3]==='NULL'?null:hex2bin($v[1]!==''?$v[1]:($v[2]??''));}}}finally{fclose($f);}
 $rows=$db->query('SELECT * FROM g5_config')->fetchAll(PDO::FETCH_ASSOC);if($old===null||count($rows)!==1)throw new RuntimeException('config_row_count');$rows[0]=array_map(fn($v)=>$v===null?null:(string)$v,$rows[0]);$changed=[];foreach(array_unique(array_merge(array_keys($old),array_keys($rows[0])))as $col)if(($old[$col]??null)!==($rows[0][$col]??null))$changed[]=$col;return $changed;
}

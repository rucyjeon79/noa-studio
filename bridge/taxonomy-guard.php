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

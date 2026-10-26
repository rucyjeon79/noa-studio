<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/storage.php';require __DIR__.'/../../bridge/package-record.php';require __DIR__.'/../../bridge/category-order-store.php';
function ncot_check(bool $v,string $name):void{if(!$v)throw new RuntimeException($name);}
$db=noa_bridge_pdo();$db->prepare('DELETE FROM noa_document_history WHERE doc_key=?')->execute([NCO_KEY]);$db->prepare('DELETE FROM noa_documents WHERE doc_key=?')->execute([NCO_KEY]);
$path=tempnam(sys_get_temp_dir(),'noa-order-');$original=json_encode(['story'=>['story:b','story:a'],'cover'=>['cover:c'],'playlists'=>[],'legacyNote'=>'preserve']);file_put_contents($path,$original);
try{
 $before=nco_read($db,$path);ncot_check($before['revision']===0&&$before['source']==='legacy','legacy_read');
 $first=nco_migrate($db,$path);ncot_check($first['revision']===1&&$first['source']==='mysql'&&$first['data']['story']===['story:b','story:a'],'exact_migration');
 ncot_check(nco_migrate($db,$path)===$first,'migration_idempotent');ncot_check(file_get_contents($path)===$original,'legacy_unchanged');
 $saved=nco_save($db,$path,'story',['story:a','story:b'],1,['story:b','story:a'],'fixture');ncot_check($saved['revision']===2&&$saved['data']['cover']===['cover:c']&&$saved['data']['legacyNote']==='preserve','sql_order_preserves_other_data');
 // ABA: even when an earlier list becomes current again, stale revision must fail.
 nco_save($db,$path,'story',['story:b','story:a'],2,['story:a','story:b'],'fixture');
 try{nco_save($db,$path,'story',[],1,['story:b','story:a'],'fixture');throw new RuntimeException('stale_revision_accepted');}catch(DomainException $e){ncot_check($e->getMessage()==='order_conflict','stale_revision');}
 try{nco_save($db,$path,'story',['x','x'],3,['story:b','story:a'],'fixture');throw new RuntimeException('duplicate_accepted');}catch(DomainException $e){}
 file_put_contents($path,'{broken');ncot_check(nco_read($db,$path)['revision']===3,'SQL_canonical_ignores_later_legacy_changes');
 $q=$db->prepare('SELECT COUNT(*) FROM noa_document_history WHERE doc_key=?');$q->execute([NCO_KEY]);ncot_check((int)$q->fetchColumn()===3,'one_history_per_committed_revision');
 echo "CATEGORY_SQL_MYSQL_OK exact_migration idempotence source_retention CAS_ABA duplicate_denial SQL_authority history\n";
}finally{unlink($path);}

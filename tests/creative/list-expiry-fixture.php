<?php
// Copied only into the isolated browser fixture; never deployed.
require __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-app/engine/creative.php';
$db=noa_bridge_pdo();if($db->query('SELECT DATABASE()')->fetchColumn()!=='noa_inline_edit_test')throw new RuntimeException('isolated_database_required');
$r=ncd_row($db,$_GET['id'],'browser-owner');$d=$r['document'];if(empty($d['_creative']['publication']))throw new RuntimeException('published_fixture_required');
$d['_creative']['publication']['at']=gmdate('c',time()-86400+6);
$db->prepare('UPDATE noa_documents SET payload=? WHERE doc_key=?')->execute([ncd_json($d),$r['doc_key']]);
$id=md5('unpublished:'.$_GET['id']);$d['_creative']['id']=$id;unset($d['_creative']['publication']);$d['_creative']['summary']['id']=$id;$d['_creative']['summary']['title']='등록 전 보관 초안';$d['_creative']['summary']['stage']='review';
$db->prepare('INSERT INTO noa_creative_drafts(draft_id,owner_id,doc_key,retained_at) VALUES(?,?,?,?)')->execute([$id,'browser-owner',ncd_key($id),time()-864000]);
$db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,1,?)')->execute([ncd_key($id),NCD_KIND,ncd_json($d),'browser-owner']);
header('Content-Type: application/json');echo json_encode(['ok'=>true,'retainedId'=>$id]);

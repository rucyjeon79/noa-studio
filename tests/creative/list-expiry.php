<?php
// Actual MySQL listing: expiry happens before sorting/pagination and never writes song/media data.
(function()use($db,$published){
 $owner='expiry-owner';$now=1800000000;$source=ncd_row($db,$published['draft']['id'],'creative-owner')['document'];
 $songSnapshot=function()use($db,$published){$q=$db->prepare('SELECT * FROM noa_documents WHERE doc_key=?');$q->execute([$published['publication']['key']]);return $q->fetch(PDO::FETCH_ASSOC);};$originalSong=$songSnapshot();$originalAsset=nj_find($db,$published['publication']['key']);
 $db->beginTransaction();
 try{
  $insert=function(string $label,?int $at,string $stage='published',string $who='expiry-owner')use($db,$source,$now){
   $id=md5($who.':'.$label);$d=$source;$d['ownerId']=$who;$d['_creative']['id']=$id;
   if($at===null)unset($d['_creative']['publication']);else $d['_creative']['publication']['at']=gmdate('c',$at);
   $d['_creative']['summary']=['id'=>$id,'title'=>$label,'stage'=>$stage,'genre'=>'your-story','completion'=>100,'updatedAt'=>gmdate('c',$now+86400),'createdAt'=>gmdate('c',$now-864000)];
   $db->prepare('INSERT INTO noa_creative_drafts(draft_id,owner_id,doc_key,retained_at) VALUES(?,?,?,?)')->execute([$id,$who,ncd_key($id),$now-864000]);
   $db->prepare('INSERT INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,?,1,?)')->execute([ncd_key($id),NCD_KIND,ncd_json($d),$who]);return $id;
  };
  $before=$insert('직전',$now-86399);$at=$insert('경계',$now-86400);$after=$insert('이후',$now-86401);$complete=$insert('미등록 완성',null,'review');$failed=$insert('미등록 수정',null,'writing');$deleted=$insert('삭제된 등록곡',$now-86400,'deleted');$insert('다른 소유자',$now,'published','expiry-other');
  $rows=ncd_list($db,$owner,[],$now);$ids=array_column($rows['items'],'id');
  check(in_array($before,$ids,true)&&!in_array($at,$ids,true)&&!in_array($after,$ids,true),'24h boundary uses publication, not later edits or original creation');
  check(in_array($complete,$ids,true)&&in_array($failed,$ids,true)&&count($ids)===3,'unpublished drafts and ownership preserved');
  check($rows['serverTime']===$now&&array_column($rows['items'],'listExpiresAt','id')[$before]===$now+1,'server deadline supplied for visible rows');
  foreach(['','published','deleted'] as $filter)foreach(['updated','created','title'] as $sort){$r=ncd_list($db,$owner,['filter'=>$filter,'sort'=>$sort,'q'=>'경계'],$now);check($r['items']===[],'expired registration absent from search/filter/sort');}
  check(ncd_list($db,$owner,['filter'=>'deleted'],$now)['items']===[],'expired publication never returns through deleted list');
  check(!in_array($before,array_column(ncd_list($db,$owner,[],$now+1)['items'],'id'),true),'expires at exactly 86400 seconds');
  for($i=0;$i<55;$i++)$insert(sprintf('A expired %03d',$i),$now-86400);
  for($i=0;$i<51;$i++)$insert(sprintf('B current %03d',$i),$now);
  $p1=ncd_list($db,$owner,['sort'=>'title','q'=>'current'],$now);$p2=ncd_list($db,$owner,['sort'=>'title','q'=>'current','offset'=>50],$now);
  check(count($p1['items'])===50&&$p1['hasMore']&&count($p2['items'])===1&&!$p2['hasMore'],'visible result pagination remains complete');
  $all=ncd_list($db,$owner,['sort'=>'title'],$now);check(count($all['items'])===50&&!str_contains($all['items'][0]['title'],'expired'),'expired first page cannot leave empty or short pages');
  check($songSnapshot()===$originalSong&&nj_find($db,$published['publication']['key'])===$originalAsset,'canonical song and asset rows unchanged');
  check(nj_verified($originalAsset,'audio')&&nj_verified($originalAsset,'cover'),'published media remains playable');
 }finally{$db->rollBack();}
 echo "CREATIVE_PUBLISHED_LIST_24H_BOUNDARY_FILTER_PAGINATION_SONG_MEDIA_PRESERVED_OK\n";
})();

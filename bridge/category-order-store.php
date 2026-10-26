<?php
declare(strict_types=1);
/** SQL owns operational ordering. The legacy file is a retained, read-only migration source. */
const NCO_KEY='meta:category-order';
function nco_validate(array $data):array{
 foreach(['story','cover']as $group){$data[$group]??=[];if(!is_array($data[$group])||!array_is_list($data[$group])||count($data[$group])>2000)throw new DomainException('order_storage_invalid');$seen=[];foreach($data[$group]as $key){if(!is_string($key)||!preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$key)||isset($seen[$key]))throw new DomainException('order_storage_invalid');$seen[$key]=true;}}
 if(isset($data['playlists'])&&(!is_array($data['playlists'])||!array_is_list($data['playlists'])))throw new DomainException('playlist_storage_invalid');
 return $data;
}
function nco_read(PDO $db,string $path):array{
 $q=$db->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([NCO_KEY]);$row=$q->fetch(PDO::FETCH_ASSOC);
 if($row){$data=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);if($row['kind']!=='meta'||!is_array($data)||($data['schema']??null)!==1)throw new DomainException('order_storage_invalid');return ['source'=>'mysql','revision'=>(int)$row['revision'],'data'=>nco_validate($data)];}
 if(is_link($path))throw new DomainException('order_storage_invalid');$raw=is_file($path)?file_get_contents($path):'{}';if($raw===false||strlen($raw)>2097152)throw new DomainException('order_storage_invalid');$data=json_decode($raw,true,512,JSON_THROW_ON_ERROR);if(!is_array($data))throw new DomainException('order_storage_invalid');return ['source'=>'legacy','revision'=>0,'data'=>nco_validate($data),'legacySha256'=>hash('sha256',$raw)];
}
function nco_migrate(PDO $db,string $path):array{
 $db->beginTransaction();try{$before=nco_read($db,$path);if($before['source']==='mysql'){$db->commit();return $before;}$data=$before['data'];$data['schema']=1;$data['legacySourceSha256']=$before['legacySha256'];nup_store($db,NCO_KEY,'meta',$data,0,'order-migration');$db->commit();return nco_read($db,$path);}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function nco_save(PDO $db,string $path,string $group,array $keys,int $revision,array $expected,string $actor):array{
 if(!in_array($group,['story','cover'],true))throw new InvalidArgumentException('invalid_order');nco_validate([$group=>$keys]);
 $db->beginTransaction();try{$state=nco_read($db,$path);if($revision!==$state['revision']||$expected!==$state['data'][$group])throw new DomainException('order_conflict');$data=$state['data'];$data[$group]=$keys;$data['schema']=1;if($state['source']==='legacy')$data['legacySourceSha256']=$state['legacySha256'];$next=nup_store($db,NCO_KEY,'meta',$data,$revision,$actor);$db->commit();return ['revision'=>$next,'data'=>$data];}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

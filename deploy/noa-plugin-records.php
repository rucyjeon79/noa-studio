<?php
declare(strict_types=1);
// Loaded only after the private plugin's owner binding is verified.
function noa_plugin_records(string $op, array $body, string $actor): array {
    if ($op === 'health') return ['managementConnected'=>true,'musicBriefReady'=>true];
    $resource=$body['resource']??'';
    $filters=['songs'=>"kind IN ('single','story')",'channels'=>"kind='prefs' AND doc_key LIKE 'creator-channel:%'",'posts'=>"kind='ecosystem_post'"];
    $allowed=['songs'=>TARGETS,'channels'=>['title','description'],'posts'=>['title','body']];
    if (!isset($filters[$resource])) throw new InvalidArgumentException('invalid_resource');
    $predicate=$filters[$resource]." AND COALESCE(JSON_EXTRACT(payload,'$._noaTrash'),'null') IN ('null','false') AND COALESCE(JSON_EXTRACT(payload,'$.deleted'),'false') IN ('false','null','0')";
    $db=noa_bridge_pdo();
    if ($op==='list') {
        $query=$body['query']??'';
        if (!is_string($query)||mb_strlen($query)>150) throw new InvalidArgumentException('invalid_query');
        $title="COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.body.displayTitle')),''),NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.body.confirmedTitle')),''),JSON_UNQUOTE(JSON_EXTRACT(payload,'$.title')),'')";
        $limit=max(1,min(50,(int)($body['limit']??15)));
        $q=$db->prepare("SELECT doc_key,revision,$title AS title FROM noa_documents WHERE $predicate AND (LOCATE(?, $title)>0 OR LOCATE(?,doc_key)>0) ORDER BY updated_at DESC,doc_key LIMIT $limit");
        $q->execute([$query,$query]);$items=[];
        foreach($q as $r)$items[]=['id'=>$r['doc_key'],'title'=>$r['title'],'revision'=>(int)$r['revision']];
        return ['items'=>$items,'fields'=>$allowed[$resource]];
    }
    $changes=$body['changes']??null;$rev=$body['expectedRevision']??null;$id=$body['id']??null;
    if(!is_string($id)||!is_int($rev)||$rev<1||!is_array($changes)||count($changes)!==1||array_diff(array_keys($changes),$allowed[$resource])) throw new InvalidArgumentException('one_supported_field_required');
    $field=array_key_first($changes);$text=$changes[$field];
    if(!is_string($text)||trim($text)===''||mb_strlen($text)>20000||($field==='youtubeTitle'&&mb_strlen($text)>100))throw new InvalidArgumentException('invalid_text');
    $db->beginTransaction();
    try{
        $q=$db->prepare("SELECT kind,payload,revision FROM noa_documents WHERE doc_key=? AND $predicate FOR UPDATE");
        $q->execute([$id]);$r=$q->fetch(PDO::FETCH_ASSOC);
        if(!$r||(int)$r['revision']!==$rev)throw new DomainException('revision_conflict_or_missing');
        $d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);
        if($resource==='songs'){
            $before=$d;$d=nup_patch($d,$r['kind'],$changes);
            nup_validate_classification($db,$id,$before,$d);
        }elseif($resource==='channels'){require_once __DIR__.'/noa-bridge/creator-core.php';$d=array_replace($d,nc_channel(array_replace($d,$changes)));}
        else{if($field==='title'&&mb_strlen($text)>120)throw new InvalidArgumentException('title_too_long');$d[$field]=$text;}
        $next=nup_store($db,$id,$r['kind'],$d,$rev,$actor);
        $db->commit();
    }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
    if($resource==='songs')nup_snapshot($db,$id,dirname(__DIR__).'/noa-ai-lab/packages/records');
    return ['saved'=>true,'id'=>$id,'field'=>$field,'revision'=>$next];
}

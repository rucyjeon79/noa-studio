<?php
declare(strict_types=1);
/** N80 JukeBox's private media owners. SELECT-only; never publish a draft to MUSIC. */
function n80_jukebox_draft_references(PDO $db): array {
    $sqlite=$db->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite';
    $sql=$sqlite?"SELECT 1 FROM sqlite_master WHERE type='table' AND name='noa_creative_drafts'"
        :"SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='noa_creative_drafts'";
    if(!$db->query($sql)->fetchColumn())return [];
    $references=[];
    $rows=$db->query("SELECT c.doc_key,c.draft_id,c.owner_id,d.payload FROM noa_creative_drafts c
        JOIN noa_documents d ON d.doc_key=c.doc_key WHERE d.kind='n80_creative_draft'");
    foreach($rows as $row){
        $id=(string)$row['draft_id'];$owner=(string)$row['owner_id'];
        $document=json_decode((string)$row['payload'],true);
        if(!preg_match('/^[a-f0-9]{32}$/D',$id)||$row['doc_key']!=='n80:draft:'.$id||$owner===''||!is_array($document)
           ||($document['ownerId']??null)!==$owner||($document['_creative']['id']??null)!==$id
           ||($document['visibility']??null)!=='draft')continue;
        // Published drafts retain their original upload provenance; their public song has a different key.
        $references[$row['doc_key']]=['kind'=>'creative_draft','publicPlayback'=>false];
    }
    return $references;
}

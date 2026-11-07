<?php
declare(strict_types=1);
require_once __DIR__.'/member-access.php';require_once __DIR__.'/package-record.php';
const NC_GENRES=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
function nc_channel_key(string $owner):string{return 'creator-channel:'.hash('sha256',$owner);}
function nc_row(PDO $db,string $key):?array{
 $q=$db->prepare('SELECT doc_key,kind,payload,revision FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)return null;$r['document']=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);$r['revision']=(int)$r['revision'];return $r;
}
function nc_own(PDO $db,string $key,array $member):array{
 $r=nc_row($db,$key);if(!$r||$r['kind']!=='story'||!str_starts_with($key,'creator:')||!nam_owner($r['document'],$member))throw new DomainException('own_song_required');return $r;
}
function nc_channel(array $body):array{
 $title=trim((string)($body['title']??''));$description=trim((string)($body['description']??''));if($title===''||mb_strlen($title)>80||mb_strlen($description)>2000)throw new InvalidArgumentException('invalid_channel');$out=['title'=>$title,'description'=>$description];
 if(array_key_exists('profileBackgroundOpacity',$body)){$opacity=$body['profileBackgroundOpacity'];if(!is_int($opacity)||$opacity<0||$opacity>100)throw new InvalidArgumentException('invalid_profile_opacity');$out['profileBackgroundOpacity']=$opacity;}return $out;
}
function nc_patch(array $document,array $body):array{
 $fields=$body['fields']??[];if(!is_array($fields)||array_diff(array_keys($fields),['title','lyrics','vocal','cast','description','geminiPrompt','communityPost','youtubeUrl','mvUrl','songDescription','lyricsTranslation','sunoPrompt','productionPrompt','characterPrompt','youtubeTitle','sunoUrl','creativeFields']))throw new InvalidArgumentException('invalid_song_fields');
 $genre=$body['genre']??($document['genreId']??'your-story');if(!is_string($genre)||!in_array($genre,NC_GENRES,true))throw new InvalidArgumentException('invalid_genre');$document['genreId']=$genre;$d=nup_patch($document,'story',$fields);
 if(mb_strlen($d['title']??'')<1)throw new InvalidArgumentException('title_required');
 $artist=$body['originalArtist']??($d['body']['originalArtist']??'');if(!is_string($artist)||mb_strlen($artist)>200||($genre==='cover-reborn'&&trim($artist)===''))throw new InvalidArgumentException('cover_original_artist_required');$d['body']['originalArtist']=$artist;
 $visibility=$body['visibility']??($d['visibility']??'private');if(!in_array($visibility,['private','public'],true))throw new InvalidArgumentException('invalid_visibility');$d['visibility']=$visibility;
 return nup_normalize($d,'story');
}
function nc_store(PDO $db,string $key,string $kind,array $d,int $revision,string $actor):int{
 $db->beginTransaction();try{$next=nup_store($db,$key,$kind,$d,$revision,$actor);$db->commit();return $next;}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}

/** Explicit ownership, independent of legacy/imported document key format. */
function nc_owned_records(PDO $db,string $owner):array{
 $q=$db->prepare("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=? ORDER BY updated_at DESC,doc_key");$q->execute([$owner]);return $q->fetchAll(PDO::FETCH_ASSOC);
}

/** Only aliases belonging to the selected owner's records leave this boundary. */
function nc_record_aliases(PDO $db,array $records):array{
 $out=[];foreach($records as $r){$k=$r['doc_key'];$out[$k]=array_values(array_unique([$k,preg_replace('/^catalog:/','',$k)]));}
 if (!$out) return [];
 try {
     foreach (array_chunk(array_keys($out), 400) as $keys) {
         $params = implode(',', array_fill(0, count($keys), '?'));
         $q = $db->prepare("SELECT alias_key,entity_id FROM noa_catalog_aliases
             WHERE batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)
               AND alias_key IN ($params) ORDER BY alias_key,entity_id");
         $q->execute($keys);
         foreach ($q as $a) $out[$a['alias_key']][] = $a['entity_id'];
     }
 } catch(PDOException $e) { error_log('[creator-aliases] catalog unavailable'); }
 return $out;
}
/** Complete record for a single edit or an older client requesting the full list. */
function nc_editor_record(PDO $db, array $row, array $doc, array $access, array $aliases): array {
    $key = $row['doc_key'];
    $managed = $row['kind'] !== 'story' || !str_starts_with($key, 'creator:');
    $state = $managed ? ['status'=>$row['kind'] === 'playlist' ? 'collection' : 'registered',
        'error'=>'', 'ready'=>false, 'audio'=>'', 'download'=>''] : nu_public($db, $key);
    $fields = nup_fields($doc);
    return ['key'=>$key, 'aliases'=>$aliases, 'ep'=>(int)($doc['ep'] ?? 0), 'act'=>(int)($doc['act'] ?? 0),
        'members'=>$doc['body']['members'] ?? [], 'kind'=>$row['kind'], 'managed'=>$managed,
        'editUrl'=>$managed && $access['admin'] ? '/noa-editor.php?key='.rawurlencode($key) : '',
        'revision'=>(int)$row['revision'], 'title'=>$fields['title'] ?: ($doc['title'] ?? '제목 없음'),
        'genre'=>$doc['genreId'] ?? '', 'visibility'=>$doc['visibility'] ?? 'public', 'fields'=>$fields,
        'originalArtist'=>$doc['body']['originalArtist'] ?? '',
        'state'=>['status'=>$state['status'], 'error'=>$state['error'], 'ready'=>$state['ready'],
            'audio'=>$state['audio'], 'download'=>$access['ownDownload'] ? $state['download'] : '']];
}
/** The editor list and AI picker read only the columns they display. */
function nc_song_index(PDO $db, string $owner, bool $admin, bool $choices = false): array {
    $columns = "owner_id VARCHAR(255) PATH '$.ownerId',
                genre VARCHAR(191) PATH '$.genreId', ep VARCHAR(64) PATH '$.ep', act VARCHAR(64) PATH '$.act',
                title TEXT PATH '$.title', display_title TEXT PATH '$.body.displayTitle',
                confirmed_title TEXT PATH '$.body.confirmedTitle', trash JSON PATH '$._noaTrash'";
    if (!$choices) {
        $columns .= ", visibility VARCHAR(32) PATH '$.visibility',
                       members JSON PATH '$.body.members'";
    }
    $q = $db->prepare("SELECT d.doc_key, d.kind, d.revision, item.*
        FROM noa_documents d JOIN JSON_TABLE(d.payload, '$' COLUMNS ($columns)) AS item ON TRUE
        WHERE d.kind IN ('single','story','playlist') AND BINARY item.owner_id = BINARY ?
          AND JSON_TYPE(JSON_EXTRACT(d.payload, '$.ownerId')) = 'STRING'
        ORDER BY d.updated_at DESC, d.doc_key");
    $q->execute([$owner]);
    $rows = $q->fetchAll(PDO::FETCH_ASSOC);
    $aliases = $choices || !$rows ? [] : nc_record_aliases($db, $rows);
    $songs = [];
    foreach ($rows as $row) {
        if (!empty(json_decode($row['trash'] ?? 'null', true))) continue;
        $key = $row['doc_key'];
        $title = nup_text($row, ['display_title', 'confirmed_title', 'title']) ?: ($row['title'] ?? '제목 없음');
        $song = ['key'=>$key, 'title'=>$title, 'kind'=>$row['kind'], 'genre'=>$row['genre'] ?? '',
                 'ep'=>(int)$row['ep'], 'act'=>(int)$row['act']];
        if (!$choices) {
            $managed = $row['kind'] !== 'story' || !str_starts_with($key, 'creator:');
            $members = $row['kind'] === 'playlist' ? json_decode($row['members'] ?? '[]', true) : [];
            $song += [
                'managed' => $managed, 'revision' => (int)$row['revision'],
                'visibility' => $row['visibility'] ?? 'public',
                'aliases' => $aliases[$key],
                'members' => array_map(static fn($m) => ['key' => is_array($m) ? ($m['key'] ?? '') : ''], is_array($members) ? $members : []),
                'editUrl' => $managed && $admin ? '/noa-editor.php?key='.rawurlencode($key) : '',
            ];
        }
        $songs[] = $song;
    }
    return $songs;
}

function nc_rules(array $body):array{
 $rules=$body['rules']??null;if(!is_array($rules)||array_diff(array_keys($rules),array_merge(['common'],NC_GENRES)))throw new InvalidArgumentException('invalid_rules');
 foreach($rules as $text)if(!is_string($text)||!mb_check_encoding($text,'UTF-8')||mb_strlen($text)>6000)throw new InvalidArgumentException('invalid_rules');return $rules;
}

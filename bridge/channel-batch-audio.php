<?php
declare(strict_types=1);

/** Batch receipts refer to immutable upload IDs. Playback files are never optimization inputs. */
function ncb_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS noa_channel_audio_batches (
        owner_id VARBINARY(191) NOT NULL, id CHAR(32) CHARACTER SET ascii NOT NULL,
        operation VARCHAR(12) NOT NULL, request_hash CHAR(64) NOT NULL, items JSON NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY(owner_id,id), KEY(owner_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function ncb_id(mixed $id): string {
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('invalid_request_id');
    return $id;
}

function ncb_keys(mixed $input): array {
    if (!is_array($input) || !array_is_list($input) || !$input || count($input)>2000) throw new InvalidArgumentException('invalid_song_selection');
    foreach ($input as $key)
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9:_-]{1,190}$/D',$key)) throw new InvalidArgumentException('invalid_song_selection');
    return array_values(array_unique($input));
}

/** Read compact current metadata, and authorize the entire selection before touching any queue. */
function ncb_documents(PDO $db, array $keys, string $owner): array {
    $params=implode(',',array_fill(0,count($keys),'?'));
    $q=$db->prepare("SELECT doc_key,kind, p.* FROM noa_documents d
        JOIN JSON_TABLE(d.payload, '$' COLUMNS (
            owner_id VARCHAR(255) PATH '$.ownerId', title TEXT PATH '$.title',
            display_title TEXT PATH '$.body.displayTitle', confirmed_title TEXT PATH '$.body.confirmedTitle',
            artist TEXT PATH '$.body.originalArtist', singer TEXT PATH '$.body.originalSinger', cover_artist TEXT PATH '$.body.coverArtist',
            trash JSON PATH '$._noaTrash'
        )) p ON TRUE WHERE doc_key IN ($params) AND kind IN ('single','story')
        AND BINARY p.owner_id=BINARY ? AND JSON_TYPE(JSON_EXTRACT(d.payload,'$.ownerId'))='STRING'");
    $q->execute([...$keys,$owner]);
    $docs=[];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        if (!empty(json_decode($r['trash']??'null',true))) continue;
        $docs[$r['doc_key']]=['title'=>nup_text($r,['display_title','confirmed_title','title'])?:'제목 없음',
            'artist'=>nup_text($r,['artist','singer','cover_artist']),
            'native'=>$r['kind']==='story' && str_starts_with($r['doc_key'],'creator:')];
    }
    if (array_diff($keys,array_keys($docs))) throw new DomainException('own_song_required');
    return $docs;
}

function ncb_audio_rows(PDO $db, array $keys): array {
    $params=implode(',',array_fill(0,count($keys),'?'));
    $q=$db->prepare("SELECT u.* FROM noa_jukebox_uploads u INNER JOIN
        (SELECT MAX(sequence) seq FROM noa_jukebox_uploads WHERE song_key IN ($params) GROUP BY song_key) l ON l.seq=u.sequence");
    $q->execute($keys);
    $uploads=array_column($q->fetchAll(PDO::FETCH_ASSOC), null, 'song_key');
    $q=$db->prepare("SELECT song_key,status,audio_path,audio_bytes,audio_sha256,
        JSON_UNQUOTE(JSON_EXTRACT(source_analysis,'$.sha256')) AS source_sha256 FROM noa_jukebox_assets WHERE song_key IN ($params)");
    $q->execute($keys);
    return [$uploads,array_column($q->fetchAll(PDO::FETCH_ASSOC),null,'song_key')];
}

function ncb_ready(?array $a): bool {
    if (!$a || $a['status']!=='ready' || (int)$a['audio_bytes']<=0 || !preg_match('/^[a-f0-9]{64}$/D',(string)$a['audio_sha256'])) return false;
    // Publication already verified the digest. Reading the entire media library here would block a genre preview.
    $path=nj_file((string)$a['audio_path']);
    return $path!==null && filesize($path)===(int)$a['audio_bytes'];
}

function ncb_complete_transfer(array $u): bool {
    if (nd_is($u)) return nu_source_exists($u);
    $dir=nu_dir($u['id']);
    if (is_file($dir.'/input.audio') && !is_link($dir.'/input.audio') && filesize($dir.'/input.audio')===(int)$u['file_bytes']) return true;
    return (int)$u['total_chunks']>0 && count(nu_chunks($u))===(int)$u['total_chunks'];
}

function ncb_plan(PDO $db,array $keys,string $owner,bool $admin): array {
    $docs=ncb_documents($db,$keys,$owner);
    [$uploads,$assets]=ncb_audio_rows($db,$keys);
    $plan=[];
    foreach ($keys as $key) {
        $u=$uploads[$key]??null; $asset=$assets[$key]??null;
        $ready=ncb_ready($asset);
        $r=['key'=>$key,'title'=>$docs[$key]['title'],'status'=>'missing','reason'=>'source_required'];
        if (!$admin && !$docs[$key]['native']) {
            $r['status']='skipped'; $r['reason']='managed_song_requires_admin';
        } elseif ($u && !$admin && $u['requested_by']!==$owner) {
            $r['status']='skipped'; $r['reason']='own_upload_required';
        } elseif ($u && in_array($u['status'],[...NQ_WAIT,...NQ_ACTIVE],true)) {
            $r['upload']=$u['id']; $r['status']=in_array($u['status'],NQ_WAIT,true)?'queued':'running'; $r['reason']='already_processing';
            // Adopt old finalized uploads that predate the durable queue, once.
            if (empty($u['lease']) && !nq_latest($db,$u['id'])) {
                if ($ready && ($asset['source_sha256']??null)===($u['sha256']??'')) {
                    unset($r['upload']); $r['status']='skipped'; $r['reason']='already_optimized';
                } elseif (!empty($u['sha256']) && nu_source_exists($u)) {
                    $r['action']='enqueue';
                } else {
                    unset($r['upload']); $r['status']='missing'; $r['reason']='source_required';
                }
            }
        } elseif ($ready && (!$u || $u['status']==='ready' || (!empty($u['sha256']) && $u['sha256']===($asset['source_sha256']??null)))) {
            $r['status']='skipped'; $r['reason']='already_optimized';
        } elseif ($u && $u['status']==='uploading' && ncb_complete_transfer($u)) {
            $r['upload']=$u['id']; $r['status']='queued'; $r['reason']='source_received'; $r['action']='finish';
        } elseif ($u && $u['status']==='failed') {
            $j=nq_latest($db,$u['id']);
            $problem=nq_retry_problem($u,$j);
            if ($problem===null && preg_match('/^[a-f0-9]{64}$/D',(string)$u['sha256'])) {
                $r['status']='queued'; $r['reason']='retry'; $r['upload']=$u['id']; $r['action']='retry';
            } else {
                $r['reason']=$problem??'source_required';
            }
        }
        $plan[]=$r;
    }
    return $plan;
}

function ncb_receipt(PDO $db,string $owner,?string $id=null,bool $lock=false): ?array {
    $sql='SELECT id,operation,request_hash,items FROM noa_channel_audio_batches WHERE owner_id=?'
        .($id!==null?' AND id=?':' ORDER BY created_at DESC,id DESC').' LIMIT 1'.($lock?' FOR UPDATE':'');
    try {
        $q=$db->prepare($sql); $q->execute($id===null?[$owner]:[$owner,$id]);
    } catch (PDOException $e) {
        if ($e->getCode()==='42S02' && !$lock) return null;
        throw $e;
    }
    $row=$q->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    $row['items']=json_decode($row['items'],true,512,JSON_THROW_ON_ERROR);
    return $row;
}

function ncb_public_item(array $r): array {
    return array_intersect_key($r,array_flip(['key','title','status','reason']));
}

function ncb_snapshot(PDO $db,?array $receipt): ?array {
    if (!$receipt) return null;
    $items=$receipt['items']; $ids=array_values(array_unique(array_column($items,'upload')));
    $states=[];
    if ($ids) {
        $params=implode(',',array_fill(0,count($ids),'?'));
        $q=$db->prepare("SELECT id,status,error FROM noa_jukebox_uploads WHERE id IN ($params)");
        $q->execute($ids); $states=array_column($q->fetchAll(PDO::FETCH_ASSOC),null,'id');
    }
    $rows=[];
    foreach ($items as $item) {
        if (isset($item['upload'])) {
            $u=$states[$item['upload']]??null;
            $item['status']=match($u['status']??'') {
                'ready'=>'done','queued','retrying'=>'queued','analyzing','processing','verifying'=>'running',
                'uploading'=>($item['reason']??'')==='source_received'?'queued':'missing', default=>'failed'
            };
            $item['reason']=($u['error']??'') ?: (($u['status']??'')==='uploading' && $item['status']==='missing'?'file_transfer_required':'');
        }
        $rows[]=ncb_public_item($item);
    }
    return ['id'=>$receipt['id'],'type'=>$receipt['operation'],'items'=>$rows];
}

function ncb_preview(PDO $db,array $keys,string $owner,bool $admin): array {
    $items=ncb_plan($db,$keys,$owner,$admin);
    return ['eligible'=>count(array_filter($items,fn($r)=>isset($r['action']))),
        'skipped'=>count(array_filter($items,fn($r)=>$r['status']==='skipped')),
        'missing'=>count(array_filter($items,fn($r)=>$r['status']==='missing')),
        'processing'=>count(array_filter($items,fn($r)=>!isset($r['action'])&&in_array($r['status'],['queued','running'],true))),
        'items'=>array_map('ncb_public_item',$items)];
}

function ncb_start(PDO $db,array $body,string $owner,bool $admin,string $operation): array {
    $id=ncb_id($body['requestId']??null);
    $retry=$operation==='retry';
    $keys=$retry?[]:ncb_keys($body['keys']??null);
    $previous=$retry?ncb_id($body['id']??null):null;
    $identity=$keys; sort($identity,SORT_STRING);
    $hash=hash('sha256',json_encode([$operation,$identity,$previous],JSON_THROW_ON_ERROR));
    ncb_schema($db);
    $finish=[]; $wake=false;
    $receipt=nq_atomic($db,function()use($db,$owner,$admin,$id,$operation,$previous,$keys,$hash,&$finish,&$wake){
        $existing=ncb_receipt($db,$owner,$id,true);
        if ($existing) {
            if (!hash_equals($existing['request_hash'],$hash)) throw new DomainException('request_conflict');
            return $existing;
        }
        $retryIds=[];
        if ($previous!==null) {
            $old=ncb_receipt($db,$owner,$previous,true);
            if (!$old) throw new DomainException('batch_not_found');
            $failed=array_filter(ncb_snapshot($db,$old)['items'],fn($r)=>$r['status']==='failed');
            $keys=array_column($failed,'key');
            if (!$keys) throw new DomainException('no_failed_items');
            $retryIds=array_column($old['items'],'upload','key');
        }
        if ($operation==='upload') {
            $docs=ncb_documents($db,$keys,$owner);
            $items=[];
            foreach ($keys as $key) {
                if (!$admin && !$docs[$key]['native']) throw new DomainException('managed_song_requires_admin');
                $items[]=['key'=>$key,'title'=>$docs[$key]['title'],'status'=>'missing','reason'=>'file_transfer_required'];
            }
        } else {
            $items=ncb_plan($db,$keys,$owner,$admin);
            foreach ($items as &$item) {
                $u=$item['upload']??null;
                if ($previous!==null && $u!==null && $u!==($retryIds[$item['key']]??'')) {
                    $item=['key'=>$item['key'],'title'=>$item['title'],'status'=>'skipped','reason'=>'source_replaced']; continue;
                }
                if (($item['action']??'')==='retry') {
                    try { nq_retry_locked($db,$u); }
                    catch (DomainException $e) {
                        unset($item['upload'],$item['action']);
                        $item['status']='failed'; $item['reason']=$e->getMessage();
                        continue;
                    }
                }
                if (($item['action']??'')==='enqueue') nq_insert($db,['id'=>$u,'song_key'=>$item['key']]);
                if (($item['action']??'')==='finish') $finish[]=$u;
                if ($item['status']==='queued') $wake=true;
                unset($item['action']);
            }
            unset($item);
        }
        $type=$operation==='upload'?'upload':'audio';
        $q=$db->prepare('INSERT INTO noa_channel_audio_batches(owner_id,id,operation,request_hash,items) VALUES(?,?,?,?,?)');
        $q->execute([$owner,$id,$type,$hash,json_encode($items,JSON_THROW_ON_ERROR)]);
        return ['id'=>$id,'operation'=>$type,'items'=>$items];
    });
    foreach ($finish as $upload) nu_finish_after_response($db,$upload);
    if ($wake) nw_after_enqueue();
    return ncb_snapshot($db,$receipt);
}

function ncb_store_items(PDO $db,string $owner,string $id,array $items): void {
    $db->prepare('UPDATE noa_channel_audio_batches SET items=? WHERE owner_id=? AND id=?')
        ->execute([json_encode($items,JSON_THROW_ON_ERROR),$owner,$id]);
}

/** Attach files only after the user has selected the canonical song in their batch. */
function ncb_upload_init(PDO $db,array $body,string $owner,bool $admin): array {
    $batch=ncb_id($body['batchId']??null);
    [$key]=ncb_keys([$body['key']??null]);
    $docs=ncb_documents($db,[$key],$owner);
    if (!$admin && !$docs[$key]['native']) throw new DomainException('managed_song_requires_admin');
    $name=$body['filename']??null; $bytes=$body['bytes']??null; $fp=$body['fingerprint']??null;
    if (!is_string($name) || !is_int($bytes) || $bytes<256 || $bytes>NU_MAX ||
        !is_string($fp) || !preg_match('/^[a-f0-9]{64}$/D',$fp)) throw new InvalidArgumentException('mp3_wav_size_or_identity_invalid');
    $identity=hash('sha256',json_encode([$name,$bytes,$fp],JSON_THROW_ON_ERROR));
    $lock='noa-batch-file-'.substr(hash('sha256',$owner),0,40);
    $q=$db->prepare('SELECT GET_LOCK(?,10)'); $q->execute([$lock]);
    if (!(int)$q->fetchColumn()) throw new DomainException('upload_busy_retry');
    try {
        $r=ncb_receipt($db,$owner,$batch);
        if (!$r || $r['operation']!=='upload') throw new DomainException('batch_not_found');
        $slot=array_search($key,array_column($r['items'],'key'),true);
        if ($slot===false) throw new DomainException('song_not_selected');
        $item=$r['items'][$slot];
        if (isset($item['file']) && $item['file']!==$identity) throw new DomainException('upload_file_changed');
        if (isset($item['upload'])) {
            $u=ncb_authorized_upload($db,$item['upload'],$owner,$admin);
            return nu_resume($u);
        }
        // Recover an init whose response/receipt write was interrupted. Only the exact file
        // accepted after this batch was created can be adopted, even if it has finished.
        $q=$db->prepare("SELECT u.* FROM noa_jukebox_uploads u, noa_channel_audio_batches b
            WHERE b.owner_id=? AND b.id=? AND u.created_at>=b.created_at AND BINARY u.requested_by=BINARY ?
            AND u.song_key=? AND u.fingerprint=? AND BINARY u.filename=BINARY ? AND u.file_bytes=? ORDER BY u.sequence DESC LIMIT 1");
        $q->execute([$owner,$batch,$owner,$key,$fp,$name,$bytes]); $u=$q->fetch(PDO::FETCH_ASSOC);
        if ($u) {
            $result=nu_resume($u);
        } else {
            if (!$admin) {
                $q=$db->prepare("SELECT COALESCE(SUM(a.audio_bytes),0) FROM noa_jukebox_assets a JOIN noa_documents d ON d.doc_key=a.song_key WHERE d.doc_key LIKE ?");
                $q->execute(['creator:'.hash('sha256',$owner).':%']); $used=(int)$q->fetchColumn();
                $q=$db->prepare("SELECT COALESCE(SUM(file_bytes),0) FROM noa_jukebox_uploads WHERE BINARY requested_by=BINARY ? AND song_key<>?
                    AND status IN ('uploading','queued','retrying','analyzing','processing','verifying')");
                $q->execute([$owner,$key]);
                if ($used+(int)$q->fetchColumn()+$bytes>1073741824) throw new DomainException('channel_storage_limit');
            }
            // Keep the canonical artist with the selected song; request input is only a fallback for an empty cover credit.
            $artist=$docs[$key]['artist'] ?: ($body['originalArtist']??'');
            if (!is_string($artist)) throw new InvalidArgumentException('cover_original_artist_required');
            $result=nu_initialize($db,['key'=>$key,'filename'=>$name,'bytes'=>$bytes,'fingerprint'=>$fp,'originalArtist'=>$artist],$owner);
            $u=nu_row($db,$result['id']);
            if (!hash_equals($owner,$u['requested_by'])) throw new DomainException('own_upload_required');
        }
        $r['items'][$slot]['upload']=$result['id']; $r['items'][$slot]['file']=$identity;
        ncb_store_items($db,$owner,$batch,$r['items']);
        return $result;
    } finally {
        $q=$db->prepare('SELECT RELEASE_LOCK(?)'); $q->execute([$lock]);
    }
}

function ncb_authorized_upload(PDO $db,string $id,string $owner,bool $admin): array {
    $u=nu_row($db,$id);
    if (!hash_equals($u['requested_by'],$owner)) throw new DomainException('own_upload_required');
    $docs=ncb_documents($db,[$u['song_key']],$owner);
    if (!$admin && !$docs[$u['song_key']]['native']) throw new DomainException('managed_song_requires_admin');
    return $u;
}

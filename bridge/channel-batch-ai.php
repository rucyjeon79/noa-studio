<?php
declare(strict_types=1);

/** The private worker accepts one task ID at a time and reads its claimed song by key. */
function ncbai_selection(array $body): array {
    $keys = $body['keys'] ?? null;
    $fields = $body['fields'] ?? null;
    $allowed = ['youtubeTitle', 'geminiPrompt', 'description', 'communityPost', 'title', 'lyrics'];
    if (!is_array($keys) || !array_is_list($keys) || !$keys || count($keys) > 3000
        || !is_array($fields) || !array_is_list($fields) || !$fields || count($fields) > count($allowed)
        || !is_bool($body['replace'] ?? false)) throw new InvalidArgumentException('invalid_selection');
    foreach ($keys as $key) {
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9:_-]{1,190}$/D', $key)) throw new InvalidArgumentException('invalid_key');
    }
    foreach ($fields as $field) {
        if (!in_array($field, $allowed, true)) throw new InvalidArgumentException('invalid_field');
    }
    return [array_values(array_unique($keys)), array_values(array_unique($fields)), $body['replace'] ?? false];
}

function ncbai_targets(array $fields, bool $replace, string $type, array $values, array $rules): array {
    $allowed = noa_publish_targets($type);
    return array_values(array_filter($fields, static function ($field) use ($allowed, $values, $replace, $rules) {
        return isset($allowed[$field]) && ($rules['genre']['output'][$allowed[$field]] ?? true) !== false
            && ($field !== 'communityPost' || ($rules['genre']['community'] ?? true) !== false)
            && ($replace || trim((string)($values[$field] ?? '')) === '');
    }));
}

/** Project metadata and presence flags; large descriptions and lyrics stay in SQL. */
function ncbai_items(PDO $db, string $owner, array $selection): array {
    [$keys, $fields, $replace] = $selection;
    $paths = ['youtubeTitle'=>['youtubeTitle'], 'geminiPrompt'=>['geminiPrompt'], 'lyrics'=>['lyricsBlock'],
        'description'=>['youtubeDescription','descriptionBlock','description'], 'communityPost'=>['communityPost','fanLetter']];
    $body = [];
    foreach ($fields as $field) {
        foreach ($paths[$field] ?? [] as $name) $body[$name] = "p_$name TEXT PATH '$.body.$name'";
    }
    $columns = implode(', ', array_merge([
        "owner_id VARCHAR(255) PATH '$.ownerId'", "genre VARCHAR(191) PATH '$.genreId'", "ep INT PATH '$.ep' NULL ON ERROR",
        "trash JSON PATH '$._noaTrash'", "document_title TEXT PATH '$.title'",
        "display_title TEXT PATH '$.body.displayTitle'", "confirmed_title TEXT PATH '$.body.confirmedTitle'",
    ], array_values($body)));
    $flags = [];
    foreach ($fields as $field) {
        if (!isset($paths[$field])) continue;
        $values = array_map(static fn($name)=> "NULLIF(TRIM(p_$name),'')", $paths[$field]);
        $flags[] = "COALESCE(".implode(',', $values).",'') <> '' AS has_$field";
    }
    $projection = 'd.doc_key,d.kind,d.revision,owner_id,genre,ep,trash,document_title,display_title,confirmed_title';
    if ($flags) $projection .= ','.implode(',', $flags);
    $rows = []; $rules = [];
    foreach (array_chunk($keys, 200) as $chunk) {
        $params = implode(',', array_fill(0, count($chunk), '?'));
        $q = $db->prepare("SELECT $projection FROM noa_documents d JOIN JSON_TABLE(d.payload, '$' COLUMNS ($columns)) AS item ON TRUE
            WHERE d.doc_key IN ($params) AND d.kind IN ('single','story') AND JSON_TYPE(JSON_EXTRACT(d.payload,'$.ownerId'))='STRING'");
        $q->execute($chunk);
        while ($row = $q->fetch(PDO::FETCH_ASSOC)) {
            if ($row['owner_id'] !== $owner || !empty(json_decode($row['trash'] ?? 'null',true))) continue;
            $genre = (string)$row['genre'];
            $rules[$genre] ??= noa_generation_rules($db, $genre, $owner);
            $title = nup_text($row, ['display_title','confirmed_title','document_title']);
            $values = ['title'=>$title];
            foreach ($fields as $field) {
                if (isset($paths[$field])) $values[$field] = !empty($row['has_'.$field]) ? '1' : '';
            }
            $type = nup_type(['genreId'=>$genre,'ep'=>$row['ep']], $row['kind']);
            $targets = ncbai_targets($fields, $replace, $type, $values, $rules[$genre]);
            $rows[$row['doc_key']] = ['key'=>$row['doc_key'], 'title'=>$title,
                'revision'=>(int)$row['revision'], 'targets'=>$targets, 'status'=>$targets ? 'queued' : 'skipped'];
        }
    }
    $items = [];
    foreach ($keys as $key) {
        if (!isset($rows[$key])) throw new DomainException('own_song_required');
        $items[] = $rows[$key];
    }
    return $items;
}

function ncbai_public(?array $batch): ?array {
    if (!$batch) return null;
    $visible = array_flip(['key','title','status','reason']);
    return ['id'=>$batch['id'], 'items'=>array_map(static fn($item)=>array_intersect_key($item, $visible), $batch['items'])];
}

function ncbai_write_state(string $dir, string $file, array $state): void {
    $bytes = json_encode($state, JSON_THROW_ON_ERROR);
    $tmp = tempnam($dir, 'gpt-');
    try {
        if (!$tmp || file_put_contents($tmp, $bytes) !== strlen($bytes) || !rename($tmp, $file)) throw new RuntimeException('state_write');
    } finally {
        if ($tmp && is_file($tmp)) unlink($tmp);
    }
}

function ncbai_request_id(array $body): string {
    $id = $body['requestId'] ?? null;
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('invalid_request_id');
    return $id;
}

function ncbai_request(array &$state, string $op, array $body, string $owner, bool $hosted): void {
    $id = ncbai_request_id($body);
    $selection = $op === 'batchStart' ? ncbai_selection($body) : null;
    $digest = hash('sha256', json_encode([$owner, $op, $selection ?? ($body['id'] ?? '')], JSON_THROW_ON_ERROR));
    if (isset($state['batchRequests'][$id])) {
        $prior = $state['batchRequests'][$id];
        if ($prior !== [$digest, $state['batch']['id'] ?? null]) throw new DomainException('batch_request_conflict');
        return;
    }
    if (!$hosted || ($state['owner'] ?? '') !== $owner) throw new DomainException('worker_offline');
    $single = $state['job'] ?? [];
    if (!empty($single['worker']) && !isset($single['saved']) && empty($single['failed']) && ($single['expires'] ?? 0) > time()) {
        throw new DomainException('single_worker_busy');
    }
    $batch = $state['batch'] ?? null;
    if ($batch && (isset($batch['job']) || in_array('queued', array_column($batch['items'], 'status'), true))) {
        throw new DomainException('batch_busy');
    }
    $db = noa_bridge_pdo();
    if ($op === 'batchStart') {
        $batch = ['id'=>$id, 'owner'=>$owner, 'replace'=>$selection[2], 'fields'=>$selection[1], 'items'=>ncbai_items($db, $owner, $selection)];
    } else {
        if (!$batch || $batch['id'] !== ($body['id'] ?? '') || $batch['owner'] !== $owner) throw new DomainException('unknown_batch');
        foreach ($batch['items'] as &$item) {
            if ($item['status'] !== 'failed') continue;
            $item['status'] = 'queued';
            unset($item['reason'], $item['task']);
        }
        unset($item);
    }
    $state['batch'] = $batch;
    $state['batchRequests'][$id] = [$digest, $batch['id']];
    if (count($state['batchRequests']) > 256) array_shift($state['batchRequests']);
}

/** Only one batch ID can be awaiting claim. A retry always gets a fresh worker ID. */
function ncbai_next(array &$batch): ?string {
    if (isset($batch['job'])) return null;
    foreach ($batch['items'] as $i => $item) {
        if ($item['status'] !== 'queued') continue;
        $task = bin2hex(random_bytes(16));
        $batch['items'][$i]['task'] = $task;
        $batch['index'] = $i;
        $batch['job'] = ['id'=>$task, 'key'=>$item['key'], 'selector'=>['type'=>'song','source'=>'music','key'=>$item['key']],
            'revision'=>$item['revision'], 'targets'=>$item['targets'], 'worker'=>true, 'hosted'=>true, 'field'=>'publishSet', 'expires'=>time()+1800];
        return $task;
    }
    return null;
}

function ncbai_finish(array &$batch, string $status, string $reason = ''): void {
    $i = $batch['index'];
    $batch['items'][$i]['status'] = $status;
    if ($reason !== '') $batch['items'][$i]['reason'] = $reason;
    unset($batch['index'], $batch['job']);
}

function ncbai_receipt(PDO $db, string $id): ?array {
    $request = substr($id,0,8).'-'.substr($id,8,4).'-'.substr($id,12,4).'-'.substr($id,16,4).'-'.substr($id,20);
    $q = $db->prepare('SELECT doc_key,request_hash,revision FROM noa_request_log WHERE request_id=?');
    $q->execute([$request]);
    return $q->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Called after a lost worker/save callback or timeout, including after a committed SQL write. */
function ncbai_recover_item(array &$batch, string $reason): void {
    $job = $batch['job'];
    $receipt = ncbai_receipt(noa_bridge_pdo(), $job['id']);
    ncbai_finish($batch, $receipt && $receipt['doc_key'] === $job['key'] ? 'done' : 'failed', $receipt ? '' : $reason);
}

/** A global dispatch failure needs an explicit retry. Never run every remaining song into the same outage. */
function ncbai_dispatch_error(array &$batch, string $task): void {
    if (($batch['job']['id'] ?? '') !== $task || !empty($batch['job']['claimed'])) return;
    ncbai_finish($batch, 'failed', 'dispatch_failed');
    foreach ($batch['items'] as &$item) {
        if ($item['status'] === 'queued') { $item['status'] = 'failed'; $item['reason'] = 'dispatch_failed'; }
    }
}

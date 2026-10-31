<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/sound-core.php';
require_once __DIR__.'/noa-bridge/inline-edit.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
const TARGETS = ['title','lyrics','sunoPrompt','geminiPrompt','youtubeTitle','description','communityPost'];
$op = $_GET['op'] ?? '';
$external = in_array($op, ['read','save'], true);
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== ($op === 'read' ? 'GET' : 'POST')) reply(405, ['error'=>'method']);
if (!$external && (empty($is_member) || ($is_admin ?? '') !== 'super')) reply(403, ['error'=>'admin_required']);
if (!$external && (($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://noastudio.ai.kr' || ($_SERVER['HTTP_X_NOA_BRIDGE_REQUEST'] ?? '') !== '1')) reply(403, ['error'=>'origin']);
$secret = $_SERVER['HTTP_X_NOA_ACTION_KEY'] ?? '';
if ($external && !preg_match('/^[a-f0-9]{64}$/D', $secret)) reply(401, ['error'=>'action_key_required']);
try {
    $body = [];
    if ($method === 'POST') {
        if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') reply(415, ['error'=>'json_required']);
        $raw = file_get_contents('php://input', false, null, 0, 64001);
        if (strlen($raw) > 64000) reply(413, ['error'=>'too_large']);
        $body = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($body)) reply(400, ['error'=>'invalid_request']);
    }
    $dir = dirname(__DIR__).'/noa-ai-lab/gpt-action';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('storage');
    $lock = fopen($dir.'/lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('lock');
    $file = $dir.'/state.json';
    $state = is_file($file) ? json_decode(file_get_contents($file), true, 32, JSON_THROW_ON_ERROR) : [];
    if ($external && (!hash_equals($state['hash'] ?? '', hash('sha256', $secret)) || ($state['owner'] ?? '') !== ($config['cf_admin'] ?? null))) reply(401, ['error'=>'invalid_key']);
    $before = $state;
    $job = $state['job'] ?? [];
    $valid = ($job['expires'] ?? 0) > time();
    $out = [];
    switch ($op) {
    case 'config':
        $out = ['configured'=>isset($state['hash']), 'url'=>$state['url'] ?? ''];
        break;
    case 'pair':
        $key = bin2hex(random_bytes(32));
        $state = ['owner'=>$member['mb_id'],'hash'=>hash('sha256',$key),'url'=>$state['url'] ?? ''];
        $out = ['key'=>$key];
        break;
    case 'link':
        $url = $body['url'] ?? '';
        if (!is_string($url) || !preg_match('~^https://chatgpt\.com/g/g-[a-zA-Z0-9]+(?:-[a-zA-Z0-9%_-]+)?/?$~D', $url)) reply(400,['error'=>'invalid_gpt_url']);
        if (!isset($state['hash'])) reply(409,['error'=>'pair_first']);
        $state['url'] = $url;
        break;
    case 'start':
        if (empty($state['url']) || ($state['owner'] ?? '') !== $member['mb_id']) reply(409,['error'=>'setup_required']);
        $selector = $body['selector'] ?? [];
        $field = $body['field'] ?? '';
        if (($selector['type'] ?? '') !== 'song' || !in_array($field,TARGETS,true)) reply(400,['error'=>'invalid_target']);
        $record = nie_resolve(noa_bridge_pdo(), $selector);
        if ($record['revision'] !== ($body['revision'] ?? null) || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'revision_conflict']);
        if (trim((string)($record['fields'][$field] ?? '')) !== '' && ($body['replace'] ?? false) !== true) reply(409,['error'=>'overwrite_confirmation']);
        $state['job'] = ['id'=>bin2hex(random_bytes(16)),'selector'=>$selector,'key'=>$record['writeKey'],'revision'=>$record['revision'],'field'=>$field,'expires'=>time()+3600];
        $out = ['url'=>$state['url'],'id'=>$state['job']['id']];
        break;
    case 'read':
    case 'save':
        if (!$valid || ($op==='save' && ($body['id'] ?? '') !== $job['id'])) reply(409,['error'=>'select_song_again']);
        $db = noa_bridge_pdo();
        if ($op==='save') $db->beginTransaction();
        $record = nie_resolve($db, $job['selector']);
        if ($record['writeKey'] !== $job['key'] || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'song_changed']);
        if ($op==='save') {
            $text = $body['text'] ?? null;
            if (!is_string($text) || trim($text)==='' || strlen($text)>48000 || ($job['field']==='youtubeTitle' && mb_strlen($text)>100)) reply(400,['error'=>'invalid_text']);
            $digest = hash('sha256', json_encode([$job['key'],$job['field'],$text], JSON_THROW_ON_ERROR));
            $id = substr($job['id'],0,8).'-'.substr($job['id'],8,4).'-'.substr($job['id'],12,4).'-'.substr($job['id'],16,4).'-'.substr($job['id'],20);
            $check = $db->prepare('SELECT request_hash, revision FROM noa_request_log WHERE request_id=? FOR UPDATE');
            $check->execute([$id]);
            if ($prior = $check->fetch(PDO::FETCH_ASSOC)) {
                if (!hash_equals($prior['request_hash'],$digest)) reply(409,['error'=>'already_saved']);
                $next = (int)$prior['revision'];
            } else {
                if ($record['revision'] !== $job['revision']) reply(409,['error'=>'revision_conflict']);
                $payload = nup_patch($record['payload'],$record['kind'],[$job['field']=>$text]);
                nup_validate_classification($db,$job['key'],$record['payload'],$payload);
                $next = nup_store($db,$job['key'],$record['kind'],$payload,$job['revision'],$state['owner']);
                $db->prepare('INSERT INTO noa_request_log(request_id,doc_key,request_hash,revision) VALUES(?,?,?,?)')->execute([$id,$job['key'],$digest,$next]);
            }
            $db->commit();
            nup_snapshot($db,$job['key'],dirname(__DIR__).'/noa-ai-lab/packages/records');
            $state['job']['saved'] = $next;
            $out = ['saved'=>true,'revision'=>$next,'field'=>$job['field']];
        } else {
            if ($record['revision'] !== $job['revision'] || isset($job['saved'])) reply(409,['error'=>'select_song_again']);
            $context = array_intersect_key($record['fields'],array_flip([...TARGETS,'songDescription','vocal','originalArtist','productionPrompt','characterPrompt']));
            $out = ['id'=>$job['id'],'field'=>$job['field'],'song'=>$context,'packageType'=>$record['packageType']];
        }
        break;
    default: reply(404,['error'=>'unknown_operation']);
    }
    if ($state !== $before) {
        $tmp = tempnam($dir, 'gpt-');
        $bytes = json_encode($state, JSON_THROW_ON_ERROR);
        try { if (!$tmp || file_put_contents($tmp,$bytes)!==strlen($bytes) || !rename($tmp,$file)) throw new RuntimeException('state_write'); }
        finally { if ($tmp && is_file($tmp)) unlink($tmp); }
    }
    reply(200,['ok'=>true]+$out);
} catch (InvalidArgumentException|JsonException $e) { reply(400,['error'=>'invalid_request']); }
catch (DomainException $e) { reply(409,['error'=>$e->getMessage()]); }
catch (Throwable $e) { error_log('[NOA GPT] '.get_class($e)); reply(503,['error'=>'storage_unavailable']); }

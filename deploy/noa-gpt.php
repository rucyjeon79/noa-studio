<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-app/engine/song-generation.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/sound-core.php';
require_once __DIR__.'/noa-bridge/inline-edit.php';
require_once __DIR__.'/noa-bridge/generation-rules.php';
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
$external = in_array($op, ['read','save','health','list','update','rules','workerPoll','workerFail'], true);
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
    $pluginHash = '150359b8182e0bca302676a20bccadb0e007a8aa0a2000309a53995c1e35f97f';
    $isPlugin = $external && !empty($state['pluginEnabled']) && hash_equals($pluginHash,hash('sha256',$secret));
    $isWorker = $external && isset($state['workerHash']) && hash_equals($state['workerHash'],hash('sha256',$secret));
    if ($external && ((!$isWorker && !$isPlugin && !hash_equals($state['hash'] ?? '',hash('sha256',$secret))) || ($state['owner'] ?? '') !== ($config['cf_admin'] ?? null))) reply(401,['error'=>'invalid_key']);
    $workerOp = in_array($op,['workerPoll','workerFail'],true);
    if ($workerOp && !$isWorker) reply(403,['error'=>'worker_key_required']);
    if ($op==='rules') {
        if (!$isPlugin) reply(403,['error'=>'plugin_required']);
        $genre=$body['genre']??'';
        if (!is_string($genre)||!preg_match('/^[a-z0-9-]{0,80}$/D',$genre)) reply(400,['error'=>'invalid_genre']);
        reply(200,['ok'=>true,'genre'=>$genre,'rules'=>noa_generation_rules(noa_bridge_pdo(),$genre),
            'thumbnailInstructions'=>noa_field_guidance('geminiPrompt')]);
    }
    if (in_array($op,['health','list','update'],true)) {
        if (!$isPlugin) reply(403,['error'=>'plugin_required']);
        require_once __DIR__.'/noa-plugin-records.php';
        reply(200,['ok'=>true]+noa_plugin_records($op,$body,$state['owner']));
    }
    $before = $state;
    $job = $state['job'] ?? [];
    $valid = ($job['expires'] ?? 0) > time();
    $out = [];
    $dispatchToken = trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'));
    if ($dispatchToken === '') $dispatchToken = (string)($state['dispatchToken'] ?? '');
    $hosted = $dispatchToken !== '' && isset($state['workerHash']);
    $workerReady = $hosted || ($state['workerSeen'] ?? 0) > time()-45;
    switch ($op) {
    case 'workerDisable':
        unset($state['workerHash'],$state['workerSeen']);
        if (!empty($job['worker'])) unset($state['job']);
        break;
    case 'dispatchSetup':
        $token = $body['token'] ?? null;
        if (!is_string($token) || !preg_match('/^github_pat_[A-Za-z0-9_]{40,200}$/D',$token)) reply(400,['error'=>'invalid_token']);
        $state['dispatchToken']=$token;
        break;
    case 'workerPair':
        $key = bin2hex(random_bytes(32));
        $state['owner'] = $member['mb_id'];
        $state['workerHash'] = hash('sha256',$key);
        unset($state['workerSeen']);
        $out = ['key'=>$key];
        break;
    case 'workerPoll':
        $state['workerSeen'] = time();
        $pending = $valid && !empty($job['worker']) && !isset($job['saved']) && !isset($job['failed']);
        if ($pending && !empty($job['hosted']) && ($body['id'] ?? '') !== $job['id']) reply(409,['error'=>'task_replaced']);
        if ($pending && empty($job['claimed'])) {
            $state['job']['claimed'] = time();
            $out = ['id'=>$job['id']];
        }
        break;
    case 'workerFail':
        if (!$valid || empty($job['worker']) || ($body['id'] ?? '') !== $job['id']) reply(409,['error'=>'task_replaced']);
        if (!isset($job['saved'])) $state['job']['failed'] = true;
        break;
    case 'pluginToggle':
        if (!is_bool($body['enabled'] ?? null)) reply(400,['error'=>'invalid_request']);
        $state['owner']=$member['mb_id'];$state['pluginEnabled']=$body['enabled'];unset($state['job']);
        break;
    case 'config':
        $out = ['workerConfigured'=>isset($state['workerHash']),'workerReady'=>$workerReady,'pluginEnabled'=>!empty($state['pluginEnabled']), 'configured'=>isset($state['hash']), 'url'=>$state['url'] ?? ''];
        break;
    case 'pair':
        $key = bin2hex(random_bytes(32));
        $state['owner']=$member['mb_id']; $state['hash']=hash('sha256',$key); unset($state['job']);
        $out = ['key'=>$key];
        break;
    case 'link':
        $url = $body['url'] ?? '';
        if (!is_string($url) || !preg_match('~^https://chatgpt\.com/g/g-[a-zA-Z0-9]+(?:-[a-zA-Z0-9%_-]+)?/?$~D', $url)) reply(400,['error'=>'invalid_gpt_url']);
        if (!isset($state['hash'])) reply(409,['error'=>'pair_first']);
        $state['url'] = $url;
        break;
    case 'progress':
        if (!$valid || ($body['id'] ?? '') !== $job['id']) reply(409,['error'=>'task_replaced']);
        $out=['saved'=>isset($job['saved']), 'failed'=>!empty($job['failed']) || (!empty($job['worker']) && time() > $job['expires']-3600+(!empty($job['hosted']) ? 1200 : 360) && !isset($job['saved']))];
        break;
    case 'start':
        $useWorker = ($body['worker'] ?? false) === true;
        if ($useWorker && !$workerReady) reply(503,['error'=>'worker_offline']);
        if ((!$useWorker && empty($state['url']) && empty($state['pluginEnabled'])) || ($state['owner'] ?? '') !== $member['mb_id']) reply(409,['error'=>'setup_required']);
        $selector = $body['selector'] ?? [];
        $field = $body['field'] ?? '';
        if (($selector['type'] ?? '') !== 'song' || !in_array($field,TARGETS,true)) reply(400,['error'=>'invalid_target']);
        $record = nie_resolve(noa_bridge_pdo(), $selector);
        if ($record['revision'] !== ($body['revision'] ?? null) || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'revision_conflict']);
        if (trim((string)($record['fields'][$field] ?? '')) !== '' && ($body['replace'] ?? false) !== true) reply(409,['error'=>'overwrite_confirmation']);
        $state['job'] = ['hosted'=>$hosted && $useWorker,'worker'=>$useWorker,'id'=>bin2hex(random_bytes(16)),'selector'=>$selector,'key'=>$record['writeKey'],'revision'=>$record['revision'],'field'=>$field,'expires'=>time()+3600];
        $out = ['worker'=>$useWorker,'plugin'=>!empty($state['pluginEnabled']),'url'=>$state['url'] ?? '', 'id'=>$state['job']['id']];
        break;
    case 'read':
    case 'save':
        if (!$valid || ($op==='save' && ($body['id'] ?? '') !== $job['id'])) reply(409,['error'=>'select_song_again']);
        if ($isWorker !== !empty($job['worker'])) reply(409,['error'=>'wrong_worker']);
        if (!empty($job['worker']) && (!$isWorker || empty($job['claimed']) || isset($job['failed']))) reply(409,['error'=>'worker_required']);
        $db = noa_bridge_pdo();
        if ($op==='save') $db->beginTransaction();
        $record = nie_resolve($db, $job['selector']);
        if ($record['writeKey'] !== $job['key'] || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'song_changed']);
        if ($op==='save') {
            $text = $body['text'] ?? null;
            if (!is_string($text) || trim($text)==='' || strlen($text)>48000 || ($job['field']==='youtubeTitle' && mb_strlen($text)>100)) reply(400,['error'=>'invalid_text']);
            noa_check_prompt_language($job['field'],$text);
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
            $genre = (string)$record['context']['genre'];
            $rules = noa_generation_rules($db,$genre,(string)($record['payload']['ownerId'] ?? ''));
            $out = ['id'=>$job['id'],'field'=>$job['field'],'song'=>$context,'packageType'=>$record['packageType'],
                'genre'=>$genre,'rules'=>$rules,'originalReadOnly'=>$record['original'] ?? null,
                'generationInstructions'=>noa_field_guidance($job['field'])];
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
    if ($op === 'start' && !empty($state['job']['hosted'])) {
        flock($lock, LOCK_UN);
        $status = n80_song_dispatch($out['id'],$dispatchToken);
        if ($status < 200 || $status >= 300) reply(502,['error'=>'dispatch_failed']);
    }
    reply(200,['ok'=>true]+$out);
} catch (InvalidArgumentException|JsonException $e) { reply(400,['error'=>'invalid_request']); }
catch (DomainException $e) { reply(409,['error'=>$e->getMessage()]); }
catch (Throwable $e) { error_log('[NOA GPT] '.get_class($e)); reply(503,['error'=>'storage_unavailable']); }

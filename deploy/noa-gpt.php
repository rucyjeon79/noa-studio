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
$external = in_array($op, ['hub','read','save','health','list','update','rules','workerPoll','workerFail','agentState','agentCheckpoint','agentValidate','agentSourceFile','agentTasks','agentStart','agentRead','agentStep','agentFile'], true);
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
        $maxBytes = $op==='hub' ? 12582912 : (in_array($op, ['batchPreview','batchStart'], true) ? 600000 : 1048576);
        $raw = file_get_contents('php://input', false, null, 0, $maxBytes+1);
        if (strlen($raw) > $maxBytes) reply(413, ['error'=>'too_large']);
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
    $workerOp = in_array($op,['workerPoll','workerFail','agentState','agentCheckpoint','agentValidate'],true);
    if ($workerOp && !$isWorker) reply(403,['error'=>'worker_key_required']);
    if ($op==='hub') {
        if (!$isPlugin) reply(403,['error'=>'plugin_required']);
        $owner=(string)$state['owner'];flock($lock,LOCK_UN);fclose($lock);
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        require_once __DIR__.'/noa-app/engine/hub-chatgpt.php';
        reply(200,n80_hub_chatgpt(n80_hub_root(),__DIR__,$body,$owner));
    }
    if (in_array($op,['agentSourceFile','agentTasks','agentStart','agentRead','agentStep','agentFile'],true)) {
        if (!$isPlugin) reply(403,['error'=>'plugin_required']);
        $owner=(string)$state['owner'];flock($lock,LOCK_UN);fclose($lock);
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        require_once __DIR__.'/noa-bridge/session-agent.php';
        reply(200,['ok'=>true]+sa_dispatch($op,$body,$owner));
    }
    $agentLease=(string)($_SERVER['HTTP_X_NOA_AGENT_LEASE']??'');
    if($isWorker)$body['_agentLease']=$agentLease;
    // Explicit SQL draft tasks share the authenticated N80 song worker, never the global legacy slot.
    $creativeId=(string)($body['id']??($_GET['id']??''));
    if($isWorker && in_array($op,['read','save','workerPoll','workerFail','agentState','agentCheckpoint','agentValidate'],true) && preg_match('/^[a-f0-9]{32}$/D',$creativeId)){
        require_once __DIR__.'/noa-app/engine/creative.php';
        $creativeDb=noa_bridge_pdo();
        if(ncd_job($creativeDb,$creativeId)){flock($lock,LOCK_UN);fclose($lock);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();reply(200,['ok'=>true]+ncd_worker($creativeDb,$op,$creativeId,$body));}
    }
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
    $out = [];
    $dispatchToken = trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'));
    if ($dispatchToken === '') $dispatchToken = (string)($state['dispatchToken'] ?? '');
    $hosted = $dispatchToken !== '' && isset($state['workerHash']);
    $workerReady = $hosted || ($state['workerSeen'] ?? 0) > time()-45;
    $batchApi = in_array($op, ['batchPreview','batchStart','batchStatus','batchRetry'], true);
    $hasBatch = isset($state['batch']);
    if ($batchApi || $hasBatch) require_once __DIR__.'/noa-bridge/channel-batch-ai.php';
    $actor = (string)($member['mb_id'] ?? '');
    if ($batchApi && ($config['cf_admin'] ?? '') !== $actor) reply(403, ['error'=>'admin_required']);
    if ($batchApi && $hasBatch && $state['batch']['owner'] !== $actor) reply(403, ['error'=>'batch_owner']);
    $batchJob = $state['batch']['job'] ?? [];
    $batchWorker = $isWorker && $batchJob && ($op === 'read' || ($body['id'] ?? '') === $batchJob['id']);
    $job = $batchWorker ? $batchJob : ($state['job'] ?? []);
    $valid = ($job['expires'] ?? 0) > time();
    $generationState = n80_engine_generation_state($job, time());
    $singleTimedOut = !$batchWorker && $generationState === 'timed_out';
    $advance = false;
    if($isWorker&&in_array($op,['read','save','workerFail','agentState','agentCheckpoint','agentValidate'],true)){
        if(in_array($op,['agentState','agentCheckpoint','agentValidate'],true)
            &&(!$valid||($body['id']??'')!==($job['id']??'')||empty($job['claimed'])||isset($job['failed'])))
            reply(409,['error'=>'task_replaced']);
        // A completed batch receipt is handled below without touching the next job's lease.
        if(($op==='read'||($body['id']??'')===($job['id']??'')))n80_agent_assert($job,$agentLease);
    }
    if ($batchJob && in_array($op, ['workerDisable','workerPair'], true)) reply(409,['error'=>'batch_busy']);
    switch ($op) {
    case 'agentState':
    case 'agentCheckpoint':
    case 'agentValidate':
        $db=noa_bridge_pdo();$record=nie_resolve($db,$job['selector']);
        if($record['writeKey']!==$job['key']||!empty($record['payload']['_noaTrash'])
            ||($batchWorker&&($record['payload']['ownerId']??null)!==$state['batch']['owner']))
            reply(409,['error'=>'song_changed']);
        if($record['revision']!==$job['revision'])reply(409,['error'=>'revision_conflict']);
        $out=n80_agent_operation($job,$op,$body,function(string $text)use($job,$record){
            if(strlen($text)>48000||trim($text)===''||($job['field']==='youtubeTitle'&&mb_strlen($text)>100))
                throw new DomainException('invalid_text');
            if($job['field']==='publishSet')n80_ai_validate_publish_set(json_decode($text,true,16,JSON_THROW_ON_ERROR),$job['targets'],$record['fields']['title']);
            else noa_check_prompt_language($job['field'],$text,$record['fields']['title']);
        });
        if($batchWorker)$state['batch']['job']=$job;else $state['job']=$job;
        break;
    case 'batchPreview':
        $items = ncbai_items(noa_bridge_pdo(), $actor, ncbai_selection($body));
        $eligible = count(array_filter($items, static fn($item)=>$item['status'] === 'queued'));
        reply(200, ['ok'=>true, 'eligible'=>$eligible, 'skipped'=>count($items)-$eligible]);
    case 'batchStatus':
        if ($batchJob && $batchJob['expires'] <= time()) {
            ncbai_timeout($state['batch']);
            $advance = true;
        }
        break;
    case 'batchStart':
    case 'batchRetry':
        ncbai_request($state, $op, $body, $actor, $hosted);
        $advance = true;
        break;
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
        if ($batchWorker) {
            if (!$valid) break;
            if (isset($job['claimed'])) {$out=n80_agent_resume($state['batch']['job'],$body);break;}
            // Re-check the canonical editor projection, including values promoted from legacy records.
            $db = noa_bridge_pdo();
            try {
                $record = nie_resolve($db, $job['selector']);
                if ($record['writeKey'] !== $job['key'] || !empty($record['payload']['_noaTrash'])
                    || ($record['payload']['ownerId'] ?? null) !== $state['batch']['owner']) throw new DomainException('song_changed');
                if ($record['revision'] !== $job['revision']) throw new DomainException('revision_conflict');
                $rules = noa_generation_rules($db, (string)$record['context']['genre'], $state['batch']['owner']);
                $targets = ncbai_targets($job['targets'], $state['batch']['replace'], $record['packageType'], $record['fields'], $rules);
                if (!$targets) {
                    ncbai_finish($state['batch'], 'skipped');
                    $advance = true;
                } else {
                    $state['batch']['job']['targets'] = $targets;
                    $state['batch']['job']['claimed'] = time();
                    $state['batch']['items'][$state['batch']['index']]['status'] = 'running';
                    $out = ['id'=>$job['id']]+n80_agent_claim($state['batch']['job'],$body);
                }
            } catch (DomainException $e) {
                ncbai_finish($state['batch'], 'failed', $e->getMessage());
                $advance = true;
            }
            break;
        }
        $state['workerSeen'] = time();
        $pending = !$singleTimedOut && $valid && !empty($job['worker']) && !isset($job['saved']) && !isset($job['failed']);
        if ($pending && !empty($job['hosted']) && ($body['id'] ?? '') !== $job['id']) reply(409,['error'=>'task_replaced']);
        if ($pending && empty($job['claimed'])) {
            $state['job']['claimed'] = time();
            $out = ['id'=>$job['id']]+n80_agent_claim($state['job'],$body);
        }
        elseif($pending)$out=n80_agent_resume($state['job'],$body);
        break;
    case 'workerFail':
        if ($batchWorker) {
            ncbai_recover_item($state['batch'], 'generation_failed');
            $advance = true;
            break;
        }
        if (!$valid || empty($job['worker']) || ($body['id'] ?? '') !== $job['id']) reply(409,['error'=>'task_replaced']);
        if (!isset($job['saved']) && empty($job['failed'])) {
            $state['job']['failed'] = true;
            $state['job']['failureReason'] = 'generation_failed';
        }
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
        $out=['claimed'=>!empty($job['claimed']),'revision'=>$job['saved']??null,'saved'=>isset($job['saved']), 'stage'=>$generationState, 'failureReason'=>$generationState==='timed_out'?'worker_timeout':($job['failureReason']??null), 'failed'=>in_array($generationState,['failed','timed_out'],true)];
        break;
    case 'start':
        $useWorker = ($body['worker'] ?? false) === true;
        if ($useWorker && $batchJob) reply(409,['error'=>'batch_busy']);
        if ($useWorker && !$workerReady) reply(503,['error'=>'worker_offline']);
        if ((!$useWorker && empty($state['url']) && empty($state['pluginEnabled'])) || ($state['owner'] ?? '') !== $member['mb_id']) reply(409,['error'=>'setup_required']);
        $selector = $body['selector'] ?? [];
        $field = $body['field'] ?? '';
        if (($selector['type'] ?? '') !== 'song' || !(in_array($field,TARGETS,true) || ($field==='publishSet' && $useWorker))) reply(400,['error'=>'invalid_target']);
        $record = nie_resolve(noa_bridge_pdo(), $selector);
        if (array_key_exists('expectedKey',$body) && $body['expectedKey'] !== $record['writeKey']) reply(409,['error'=>'song_changed']);
        if ($record['revision'] !== ($body['revision'] ?? null) || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'revision_conflict']);
        if (trim((string)($record['fields'][$field] ?? '')) !== '' && ($body['replace'] ?? false) !== true) reply(409,['error'=>'overwrite_confirmation']);
        $targets=[];
        if ($field==='publishSet') {
            $requested=$body['targets']??null;
            $allowed=noa_publish_targets($record['packageType']);
            if (!is_array($requested)||!array_is_list($requested)||!$requested||count($requested)>count($allowed)) reply(400,['error'=>'invalid_targets']);
            $rules=noa_generation_rules(noa_bridge_pdo(),(string)$record['context']['genre'],(string)($record['payload']['ownerId']??''));
            foreach ($requested as $k) {
                if (!is_string($k)||!isset($allowed[$k])||in_array($k,$targets,true)) reply(400,['error'=>'invalid_targets']);
                if (($rules['genre']['output'][$allowed[$k]]??true)===false || ($k==='communityPost' && ($rules['genre']['community']??true)===false)) continue;
                if (trim((string)($record['fields'][$k]??''))!=='' && ($body['replace']??false)!==true) reply(409,['error'=>'overwrite_confirmation']);
                $targets[]=$k;
            }
            if (!$targets) reply(409,['error'=>'no_enabled_fields']);
        }
        $state['job'] = ['targets'=>$targets,'hosted'=>$hosted && $useWorker,'worker'=>$useWorker,'id'=>bin2hex(random_bytes(16)),'selector'=>$selector,'key'=>$record['writeKey'],'revision'=>$record['revision'],'field'=>$field,'expires'=>time()+3600];
        $out = ['targets'=>$targets,'worker'=>$useWorker,'plugin'=>!empty($state['pluginEnabled']),'url'=>$state['url'] ?? '', 'id'=>$state['job']['id']];
        break;
    case 'read':
    case 'save':
        if ($isWorker && $op === 'save' && $hasBatch && !$batchWorker) {
            foreach ($state['batch']['items'] as $item) {
                if ($item['status'] !== 'done' || ($item['task'] ?? '') !== ($body['id'] ?? null)) continue;
                $receipt = ncbai_receipt(noa_bridge_pdo(), $item['task']);
                $digest = hash('sha256', json_encode([$item['key'],'publishSet',$body['text'] ?? null], JSON_THROW_ON_ERROR));
                if (!$receipt || $receipt['doc_key'] !== $item['key'] || !hash_equals($receipt['request_hash'],$digest)) reply(409,['error'=>'already_saved']);
                reply(200, ['ok'=>true, 'saved'=>true, 'revision'=>(int)$receipt['revision'], 'field'=>'publishSet']);
            }
        }
        if (!$valid || ($op==='save' && ($body['id'] ?? '') !== $job['id'])) reply(409,['error'=>'select_song_again']);
        if ($singleTimedOut) reply(409,['error'=>'worker_timeout']);
        if ($isWorker !== !empty($job['worker'])) reply(409,['error'=>'wrong_worker']);
        if (!empty($job['worker']) && (!$isWorker || empty($job['claimed']) || isset($job['failed']))) reply(409,['error'=>'worker_required']);
        $db = noa_bridge_pdo();
        if ($op==='save') $db->beginTransaction();
        $record = nie_resolve($db, $job['selector']);
        if ($record['writeKey'] !== $job['key'] || !empty($record['payload']['_noaTrash'])) reply(409,['error'=>'song_changed']);
        if ($batchWorker && ($record['payload']['ownerId'] ?? null) !== $state['batch']['owner']) reply(409,['error'=>'song_changed']);
        if ($op==='save') {
            $text = $body['text'] ?? null;
            if (!is_string($text) || trim($text)==='' || strlen($text)>48000 || ($job['field']==='youtubeTitle' && mb_strlen($text)>100)) reply(400,['error'=>'invalid_text']);
            n80_agent_candidate($job,$text);
            $patch=[$job['field']=>$text];
            if ($job['field']==='publishSet') {
                $patch=json_decode($text,true,16,JSON_THROW_ON_ERROR);
                try { n80_ai_validate_publish_set($patch,$job['targets'],$record['fields']['title']); }
                catch (InvalidArgumentException $e) { reply(400,['error'=>'invalid_publish_set']); }
            } else noa_check_prompt_language($job['field'],$text,$record['fields']['title']);
            $digest = hash('sha256', json_encode([$job['key'],$job['field'],$text], JSON_THROW_ON_ERROR));
            $id = substr($job['id'],0,8).'-'.substr($job['id'],8,4).'-'.substr($job['id'],12,4).'-'.substr($job['id'],16,4).'-'.substr($job['id'],20);
            $check = $db->prepare('SELECT request_hash, revision FROM noa_request_log WHERE request_id=? FOR UPDATE');
            $check->execute([$id]);
            if ($prior = $check->fetch(PDO::FETCH_ASSOC)) {
                if (!hash_equals($prior['request_hash'],$digest)) reply(409,['error'=>'already_saved']);
                $next = (int)$prior['revision'];
            } else {
                if ($record['revision'] !== $job['revision']) reply(409,['error'=>'revision_conflict']);
                $payload = nup_patch($record['payload'],$record['kind'],$patch);
                nup_validate_classification($db,$job['key'],$record['payload'],$payload);
                $next = nup_store($db,$job['key'],$record['kind'],$payload,$job['revision'],$state['owner']);
                $db->prepare('INSERT INTO noa_request_log(request_id,doc_key,request_hash,revision) VALUES(?,?,?,?)')->execute([$id,$job['key'],$digest,$next]);
            }
            $db->commit();
            nup_snapshot($db,$job['key'],dirname(__DIR__).'/noa-ai-lab/packages/records');
            if($batchWorker)n80_agent_finish($state['batch']['job'],['saved'=>true,'revision'=>$next]);
            else n80_agent_finish($state['job'],['saved'=>true,'revision'=>$next]);
            if ($batchWorker) {
                ncbai_finish($state['batch'], 'done');
                $advance = true;
            } else $state['job']['saved'] = $next;
            $out = ['saved'=>true,'revision'=>$next,'field'=>$job['field']];
        } else {
            if ($record['revision'] !== $job['revision'] || isset($job['saved'])) reply(409,['error'=>'select_song_again']);
            $context = array_intersect_key($record['fields'],array_flip(['title','lyrics','sunoPrompt','songDescription','vocal','originalArtist','productionPrompt','characterPrompt']));
            $genre = (string)$record['context']['genre'];
            $rules = noa_generation_rules($db,$genre,(string)($record['payload']['ownerId'] ?? ''));
            $out = ['id'=>$job['id'],'field'=>$job['field'],'song'=>$context,'packageType'=>$record['packageType'],
                'genre'=>$genre,'rules'=>$rules,'originalReadOnly'=>$record['original'] ?? null,
                'generationInstructions'=>'Use only the selected song and its linked original for facts. Genre examples describe format only. '.($job['field']==='publishSet' ? 'Return a JSON object only, no markdown. Exactly these fields: '.json_encode(array_combine($job['targets'],array_map('noa_field_guidance',$job['targets'])),JSON_UNESCAPED_UNICODE).'. Gemini instructions in English, max 1000 characters; youtubeTitle max 100.' : noa_field_guidance($job['field']))];
        }
        break;
    default: reply(404,['error'=>'unknown_operation']);
    }
    $dispatchBatch = $advance ? ncbai_next($state['batch']) : null;
    if ($batchApi) $out = ['batch'=>ncbai_public($state['batch'] ?? null)];
    if ($state !== $before) {
        n80_engine_write_state($dir, $file, $state);
    }
    if ($dispatchBatch !== null) {
        $latestBatch = ncbai_dispatch($lock, $dir, $file, $dispatchBatch, $dispatchToken);
        if ($batchApi && $latestBatch !== null) $out = ['batch'=>ncbai_public($latestBatch)];
    }
    if ($op === 'start' && !empty($state['job']['hosted'])) {
        ignore_user_abort(true);
        flock($lock, LOCK_UN);
        $status = n80_auto_dispatch($out['id'],$dispatchToken,'song_generation');
        if ($status < 200 || $status >= 300) {
            // Delivery may have succeeded before a transport timeout. Respect a concurrent claim or save.
            if (!flock($lock, LOCK_EX)) throw new RuntimeException('lock');
            $latest = json_decode(file_get_contents($file), true, 32, JSON_THROW_ON_ERROR);
            $current = $latest['job'] ?? [];
            if (($current['id'] ?? '') !== $out['id']) reply(409,['error'=>'task_replaced']);
            if (empty($current['claimed']) && !isset($current['saved'])) {
                $latest['job']['failed'] = true;
                $latest['job']['failureReason'] = 'dispatch_failed';
                n80_engine_write_state($dir, $file, $latest);
                reply(502,['error'=>'dispatch_failed']);
            }
        }
    }
    reply(200,['ok'=>true]+$out);
} catch (InvalidArgumentException|JsonException $e) { reply(400,['error'=>'invalid_request']); }
catch (DomainException $e) { reply(409,['error'=>$e->getMessage()]); }
catch (Throwable $e) { error_log('[NOA GPT] '.get_class($e)); reply(503,['error'=>'storage_unavailable']); }

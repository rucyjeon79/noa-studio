<?php
declare(strict_types=1);
/**
 * N80 -> ChatGPT assistance handoff. No provider calls or worker dispatch.
 * The authenticated N80 caller supplies a canonical task resolver; the hub's
 * existing private JSON store and lock supply durable idempotency.
 */
const N80_HANDOFF_STATE = 'chatgpt-handoffs.json';
const N80_HANDOFF_MAX = 64;

function n80_handoff_hex(mixed $value, int $length): bool {
    return is_string($value) && preg_match('/^[a-f0-9]{'.$length.'}$/D', $value) === 1;
}

function n80_handoff_request_valid(array $request, string $owner): bool {
    $required = ['taskId','taskKey','userActionId','sourceRevision','sourceSha256',
        'origin','stage','capability','reasonCode'];
    if ($owner === '' || strlen($owner) > 160 || preg_match('/[\x00-\x1f]/', $owner)
        || array_diff(array_keys($request), $required)
        || array_diff($required, array_keys($request))) return false;
    if (!n80_handoff_hex($request['taskId'], 32)
        || !n80_handoff_hex($request['userActionId'], 32)
        || !n80_handoff_hex($request['sourceSha256'], 64)
        || !is_int($request['sourceRevision']) || $request['sourceRevision'] < 1
        || $request['sourceRevision'] > 1000000000
        || !is_string($request['taskKey'])
        || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/D', $request['taskKey'])
        || !is_string($request['stage'])
        || !preg_match('/^[a-z][a-z0-9_]{1,63}$/D', $request['stage'])) return false;
    if ($request['origin'] !== 'user_action') return false;
    if (!in_array($request['capability'], [
        'chatgpt_review','text_generation','image_generation','video_generation',
        'browser_interaction','external_integration','engine_upgrade'], true)) return false;
    return in_array($request['reasonCode'], [
        'model_unavailable','tool_unavailable','validation_blocked',
        'integration_unavailable','manual_review_required','upgrade_required'], true);
}

function n80_handoff_submit(
    string $root, array $request, string $owner, callable $resolveCanonicalTask, ?int $now = null
): array {
    if (!n80_handoff_request_valid($request, $owner))
        return ['ok'=>false,'error'=>'handoff_request_not_authorized'];
    $now ??= time();
    if ($now <= 0) return ['ok'=>false,'error'=>'handoff_time_invalid'];
    return n80_hub_locked($root, static function() use ($root, $request, $owner, $resolveCanonicalTask, $now): array {
        // The request is never proof of itself. The existing task store must
        // verify user origin, current revision and exact owner first.
        $task = $resolveCanonicalTask($request['taskKey'], $owner);
        if (!is_array($task) || ($task['owner'] ?? null) !== $owner
            || ($task['taskId'] ?? null) !== $request['taskId']
            || ($task['userActionId'] ?? null) !== $request['userActionId']
            || ($task['sourceRevision'] ?? null) !== $request['sourceRevision']
            || ($task['sourceSha256'] ?? null) !== $request['sourceSha256']
            || ($task['origin'] ?? null) !== 'user_action'
            || !in_array(($task['state'] ?? ''), ['running','blocked','needs_review'], true))
            return ['ok'=>false,'error'=>'handoff_source_not_verified'];
        $store = n80_hub_read($root, N80_HANDOFF_STATE, ['version'=>1,'items'=>[]]);
        if (($store['version'] ?? null) !== 1 || !is_array($store['items'] ?? null))
            return ['ok'=>false,'error'=>'handoff_store_invalid'];
        $id = substr(hash('sha256', json_encode([
            $owner, $request['taskId'], $request['userActionId'],
            $request['sourceRevision'], $request['sourceSha256'],
            $request['capability'], $request['reasonCode']], JSON_THROW_ON_ERROR)), 0, 32);
        $fingerprint = hash('sha256', json_encode($request, JSON_THROW_ON_ERROR));
        if (isset($store['items'][$id])) {
            $prev = $store['items'][$id];
            if (($prev['fingerprint'] ?? null) !== $fingerprint
                || ($prev['owner'] ?? null) !== $owner)
                return ['ok'=>false,'error'=>'handoff_identity_conflict'];
            return ['ok'=>true,'status'=>'already_recorded','handoffId'=>$id,
                'state'=>$prev['state'] ?? 'unconfirmed','workerExecuted'=>false];
        }
        if (count($store['items']) >= N80_HANDOFF_MAX)
            return ['ok'=>false,'error'=>'handoff_capacity_review_required'];
        $store['items'][$id] = [
            'id'=>$id,'owner'=>$owner,'fingerprint'=>$fingerprint,
            'taskId'=>$request['taskId'],'taskKey'=>$request['taskKey'],
            'userActionId'=>$request['userActionId'],
            'sourceRevision'=>$request['sourceRevision'],'sourceSha256'=>$request['sourceSha256'],
            'origin'=>'user_action','stage'=>$request['stage'],
            'capability'=>$request['capability'],'reasonCode'=>$request['reasonCode'],
            'state'=>'needs_chatgpt','createdAt'=>$now,'resultSha256'=>null,
        ];
        n80_hub_write($root, N80_HANDOFF_STATE, $store);
        return ['ok'=>true,'status'=>'recorded','handoffId'=>$id,
            'state'=>'needs_chatgpt','workerExecuted'=>false];
    });
}

/** Safe owner-scoped status: no prompts, task content, credentials or result text. */
function n80_handoff_status(string $root, string $owner): array {
    if ($owner === '') return ['ok'=>false,'mode'=>'read_only','reason'=>'owner_missing'];
    $store = n80_hub_read($root, N80_HANDOFF_STATE, ['version'=>1,'items'=>[]]);
    if (($store['version'] ?? null) !== 1 || !is_array($store['items'] ?? null))
        return ['ok'=>false,'mode'=>'read_only','reason'=>'store_invalid'];
    $pending = [];
    $resolved = 0;
    foreach ($store['items'] as $entry) {
        if (!is_array($entry) || ($entry['owner'] ?? null) !== $owner) continue;
        if (($entry['state'] ?? null) === 'verified_applied') { $resolved++; continue; }
        if (($entry['state'] ?? null) !== 'needs_chatgpt') continue;
        $pending[] = ['handoffId'=>$entry['id'],
            'capability'=>$entry['capability'], 'reasonCode'=>$entry['reasonCode'],
            'createdAt'=>$entry['createdAt']];
    }
    usort($pending, static fn(array $a,array $b):int => $a['createdAt'] <=> $b['createdAt']);
    return ['ok'=>true,'mode'=>'read_only','pendingCount'=>count($pending),
        'verifiedAppliedCount'=>$resolved,'pending'=>array_slice($pending,0,10),
        'automaticDispatch'=>false,'unattendedChatgptExecutionVerified'=>false,
        'nextAction'=>count($pending) ? 'open_existing_task_with_chatgpt' : 'await_user_action'];
}

/** Only the canonical task owner can mark an actually saved result as applied. */
function n80_handoff_mark_applied(
    string $root, string $handoffId, string $owner, string $resultSha256,
    callable $verifySavedResult, ?int $now = null
): array {
    if (!n80_handoff_hex($handoffId,32) || !n80_handoff_hex($resultSha256,64) || $owner === '')
        return ['ok'=>false,'error'=>'handoff_receipt_invalid'];
    $now ??= time();
    return n80_hub_locked($root, static function() use ($root,$handoffId,$owner,$resultSha256,$verifySavedResult,$now):array {
        $store = n80_hub_read($root,N80_HANDOFF_STATE,['version'=>1,'items'=>[]]);
        $row = $store['items'][$handoffId] ?? null;
        if (!is_array($row) || ($row['owner'] ?? null) !== $owner)
            return ['ok'=>false,'error'=>'handoff_not_found'];
        if (($row['state'] ?? '') === 'verified_applied')
            return hash_equals((string)$row['resultSha256'],$resultSha256)
                ? ['ok'=>true,'status'=>'already_verified','handoffId'=>$handoffId]
                : ['ok'=>false,'error'=>'handoff_receipt_conflict'];
        if (($row['state'] ?? '') !== 'needs_chatgpt')
            return ['ok'=>false,'error'=>'handoff_state_invalid'];
        $saved = $verifySavedResult($row['taskKey'],$owner,$handoffId);
        if (!is_array($saved) || ($saved['owner'] ?? null) !== $owner
            || ($saved['taskId'] ?? null) !== $row['taskId']
            || ($saved['sourceSha256'] ?? null) !== $row['sourceSha256']
            || ($saved['resultSha256'] ?? null) !== $resultSha256
            || !is_int($saved['savedRevision'] ?? null)
            || $saved['savedRevision'] <= $row['sourceRevision']
            || ($saved['verified'] ?? false) !== true)
            return ['ok'=>false,'error'=>'handoff_result_not_verified'];
        $store['items'][$handoffId]['state']='verified_applied';
        $store['items'][$handoffId]['resultSha256']=$resultSha256;
        $store['items'][$handoffId]['appliedRevision']=$saved['savedRevision'];
        $store['items'][$handoffId]['appliedAt']=$now;
        n80_hub_write($root,N80_HANDOFF_STATE,$store);
        return ['ok'=>true,'status'=>'verified_applied','handoffId'=>$handoffId,
            'sourceRevision'=>$row['sourceRevision'],'savedRevision'=>$saved['savedRevision']];
    });
}

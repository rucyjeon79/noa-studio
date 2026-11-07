<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }

/** Only dispatch the installed audio workflow on the production branch. */
function nw_dispatch(string $token,string $workflow='noa-jukebox.yml'): int {
    if(!in_array($workflow,['noa-jukebox.yml','noa-ai-worker.yml'],true))return 0;
    if (!function_exists('curl_init')) return 0;
    $request = curl_init('https://api.github.com/repos/rucyjeon79/noa-studio/actions/workflows/'.rawurlencode($workflow).'/dispatches');
    curl_setopt_array($request, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => '{"ref":"main"}',
        CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$token, 'Accept: application/vnd.github+json',
            'Content-Type: application/json', 'X-GitHub-Api-Version: 2022-11-28'],
        CURLOPT_USERAGENT => 'NOA-upload-wake', CURLOPT_CONNECTTIMEOUT_MS => 2000,
        CURLOPT_TIMEOUT_MS => 5000, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION => static fn($ch, $data) => strlen($data),
    ]);
    curl_exec($request);
    return (int)curl_getinfo($request, CURLINFO_RESPONSE_CODE);
}

function nw_request(string $directory, ?callable $send = null, ?int $now = null,string $workflow='noa-jukebox.yml'): string {
    if(!in_array($workflow,['noa-jukebox.yml','noa-ai-worker.yml'],true))return 'invalid_workflow';
    $lock = null;
    try {
        $credential = $directory.'/upload-wake-token';
        if (is_link($directory) || !is_dir($directory) || is_link($credential)) return 'unsafe_permissions';
        if (is_file($credential)) {
            if ((fileperms($credential) & 0077) !== 0) return 'unsafe_permissions';
            $token = trim((string)file_get_contents($credential, false, null, 0, 1024));
        } else {
            // If the site's existing Actions credential already covers this repository,
            // use it in place. Only GitHub receives it. No new grant is requested.
            $token = trim((string)getenv('NOA_GITHUB_DISPATCH_TOKEN'));
            if ($token === '') {
                $config = dirname($directory).'/noa-ai-lab/gpt-action/state.json';
                if (!is_file($config) || is_link($config)) return 'not_configured';
                $settings = json_decode((string)file_get_contents($config), true);
                $token = (string)($settings['dispatchToken'] ?? '');
            }
        }
        if ($token === '') return 'not_configured';
        if (!preg_match('/^[A-Za-z0-9_]{20,255}$/D', $token)) return 'invalid_configuration';
        $path = $directory.($workflow==='noa-jukebox.yml'?'/upload-wake-state':'/n80-ai-wake-state');
        if (is_link($path)) return 'unsafe_state';
        $lock = @fopen($path, 'c+');
        if (!$lock) return 'unavailable';
        @chmod($path, 0600);
        if (!flock($lock, LOCK_EX | LOCK_NB)) return 'already_requested';
        $now ??= time();
        $state = json_decode(stream_get_contents($lock) ?: '{}', true) ?: [];
        $last = (int)($state['at'] ?? 0);
        $delay = !empty($state['accepted']) ? 60 : 10;
        if ($last > 0 && $now >= $last && $now - $last < $delay) return !empty($state['accepted']) ? 'already_requested' : 'recovery_pending';
        try { $http = $send?$send($token):nw_dispatch($token,$workflow); } catch (Throwable $e) { $http = 0; }
        $accepted = in_array($http, [200, 204], true);
        rewind($lock);
        ftruncate($lock, 0);
        fwrite($lock, json_encode(['at'=>$now, 'accepted'=>$accepted, 'http'=>$http]));
        fflush($lock);
        return $accepted ? 'requested' : 'recovery_pending';
    } catch (Throwable $e) { return 'recovery_pending'; }
    finally { if (is_resource($lock)) { flock($lock, LOCK_UN); fclose($lock); } }
}

function nw_after_enqueue(): void { nw_request(nj_private()); }

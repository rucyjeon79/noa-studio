<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
/** Called only after a verified audio GET has read its first nonempty block.
 * Ranking failures never prevent audio delivery. No token is put in a URL/header.
 */
function nj_track_verified_audio(PDO $db, array $doc, string $songKey, bool $admin, array &$session, int $now): void {
    if ($admin) return;
    try {
        require_once dirname(__DIR__, 2).'/noa-bridge/popularity-plays.php';
        if (!np_ready($db)) return;
        $active = $session['noa_popularity_active'][$songKey] ?? null;
        // Range requests, seeking and pause/resume belong to the same play.
        if (is_array($active) && ($active['expiresAt'] ?? 0) >= $now) return;
        if (!np_policy($db)['values']['playbackIntegrationEnabled']) return;
        $rows = nt_annotate_records($db, [['key'=>$songKey, 'kind'=>$doc['_kind'], 'catalogId'=>$doc['_catalog_id']??null]]);
        $sid = $rows[0]['catalogSongId'] ?? null;
        if (!$sid) return;
        $key = trim((string)file_get_contents(dirname(G5_PATH).'/noa-ai-lab/worker.key'));
        if (!preg_match('/^[a-f0-9]{64}$/Di', $key)) return;
        global $member;
        $identity = !empty($member['mb_id']) ? 'member:'.$member['mb_id'] : 'anonymous:'.($_SERVER['REMOTE_ADDR']??'').':'.substr($_SERVER['HTTP_USER_AGENT']??'', 0, 256);
        $actor = hash_hmac('sha256', 'NOA-PLAY-ACTOR-1:'.$identity, $key);
        $pending = $session['noa_popularity_pending'][$songKey] ?? null;
        $token = is_array($pending) && ($pending['createdAt']??0) >= $now-120 && ($pending['createdAt']??0) <= $now ? ($pending['token']??'') : '';
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) $token = np_start_play($db, $actor, $sid, $songKey, false, $now)['token'];
        if (!np_stream_started($db, $token, $songKey, false, $now)) return;
        unset($session['noa_popularity_pending'][$songKey]);
        $session['noa_popularity_active'] ??= [];
        foreach ($session['noa_popularity_active'] as $k=>$v) if (($v['expiresAt']??0)<$now) unset($session['noa_popularity_active'][$k]);
        if (count($session['noa_popularity_active'])>=20) array_shift($session['noa_popularity_active']);
        $session['noa_popularity_active'][$songKey] = ['token'=>$token,'expiresAt'=>$now+np_policy($db)['values']['sessionMaxSeconds']];
    } catch (Throwable $e) { error_log('[jukebox-play-tracking] '.get_class($e)); }
}

<?php
declare(strict_types=1);
/**
 * Member-scoped durable push preference. Browser permissions remain device-scoped.
 * Existing pre-migration subscriptions have a NULL preference and stay intact.
 */
function busan_push_pref_table(): string {
    if (!defined('G5_TABLE_PREFIX')) throw new RuntimeException('push_table_prefix_missing');
    $table=G5_TABLE_PREFIX.'busan_push_preferences';
    if (!preg_match('/^[A-Za-z0-9_]+$/D',$table)) throw new RuntimeException('push_table_invalid');
    return $table;
}
function busan_push_pref_read(string $memberId): ?bool {
    static $cache=[];
    if ($memberId==='') return null;
    if (array_key_exists($memberId,$cache)) return $cache[$memberId];
    $table=busan_push_pref_table();
    $id=sql_real_escape_string($memberId);
    $result=sql_query("SELECT enabled FROM {$table} WHERE mb_id='{$id}' LIMIT 1",false);
    if (!$result) throw new RuntimeException('push_preference_read_failed');
    $row=sql_fetch_array($result);
    $cache[$memberId]=is_array($row)&&array_key_exists('enabled',$row)
        ? (int)$row['enabled']===1 : null;
    return $cache[$memberId];
}
function busan_push_pref_write(string $memberId,bool $enabled):void {
    if ($memberId==='') throw new RuntimeException('push_member_missing');
    $table=busan_push_pref_table();
    $id=sql_real_escape_string($memberId);
    $value=$enabled?1:0;
    $ok=sql_query("INSERT INTO {$table} (mb_id,enabled,updated_at) VALUES ('{$id}',{$value},NOW()) ON DUPLICATE KEY UPDATE enabled={$value},updated_at=NOW()",false);
    if (!$ok) throw new RuntimeException('push_preference_write_failed');
}

<?php
declare(strict_types=1);
// This file is never deployed permanently. The installer replaces __TOKEN_HASH__,
// uploads it to a random temporary filename, invokes it once and removes it.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD']??'') !== 'POST' ||
    !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_MIGRATE']??''))) {
    http_response_code(404);exit;
}
try {
    require_once dirname(__DIR__).'/common.php';
    if (!defined('G5_TABLE_PREFIX') || !function_exists('sql_query')) {
        throw new RuntimeException('bootstrap_missing');
    }
    $table=G5_TABLE_PREFIX.'busan_push_preferences';
    if (!preg_match('/^[A-Za-z0-9_]+$/D',$table)) {
        throw new RuntimeException('table_name');
    }
    $ddl="CREATE TABLE IF NOT EXISTS {$table} ("
        ."mb_id VARCHAR(64) NOT NULL PRIMARY KEY,"
        ."enabled TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,"
        ."updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
        .") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    if (!sql_query($ddl,false)) throw new RuntimeException('create_failed');
    $res=sql_query("SHOW COLUMNS FROM {$table}",false);
    if (!$res) throw new RuntimeException('schema_check_failed');
    $columns=[];
    while ($row=sql_fetch_array($res)) {
        $columns[$row['Field']]=['type'=>strtolower($row['Type']),
                                'null'=>$row['Null'],'key'=>$row['Key']];
    }
    if (!isset($columns['mb_id'],$columns['enabled'],$columns['updated_at']) ||
        $columns['mb_id']['key']!=='PRI' ||
        !str_starts_with($columns['enabled']['type'],'tinyint') ||
        $columns['enabled']['null']!=='NO') {
        throw new RuntimeException('existing_table_incompatible');
    }
    echo json_encode(['ok'=>true,'schema_verified'=>true,
                      'member_records_changed'=>0,
                      'table_created_or_already_present'=>true]);
} catch (Throwable $error) {
    http_response_code(503);
    echo json_encode(['ok'=>false,'code'=>'preference_schema_unavailable']);
}

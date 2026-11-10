<?php
declare(strict_types=1);
/** N80 DB. No eager connection, no new database, unchanged transaction ownership. */
function n80_db_connection(): PDO {
    $dsn = getenv('NOA_MYSQL_DSN');
    $user = getenv('NOA_MYSQL_USER');
    $pass = getenv('NOA_MYSQL_PASSWORD');
    if (!$dsn || !$user || $pass === false) {
        if (!defined('G5_MYSQL_HOST') || !defined('G5_MYSQL_DB')) {
            throw new RuntimeException('GnuBoard database configuration unavailable');
        }
        $dsn = 'mysql:host=' . G5_MYSQL_HOST . ';dbname=' . G5_MYSQL_DB . ';charset=utf8mb4';
        $user = G5_MYSQL_USER;
        $pass = G5_MYSQL_PASSWORD;
    }
    return new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false]);
}
function n80_db_readonly_connection(): PDO {
    foreach(['G5_MYSQL_HOST','G5_MYSQL_DB','G5_MYSQL_USER','G5_MYSQL_PASSWORD'] as $k)if(!defined($k))throw new RuntimeException('db_config_missing');
    $db=new PDO('mysql:host='.G5_MYSQL_HOST.';dbname='.G5_MYSQL_DB.';charset=utf8mb4',G5_MYSQL_USER,G5_MYSQL_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false,PDO::MYSQL_ATTR_MULTI_STATEMENTS=>false,PDO::MYSQL_ATTR_USE_BUFFERED_QUERY=>false]);
    $db->exec("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES'");$db->exec("SET SESSION time_zone='+00:00'");
    $db->exec('SET SESSION max_execution_time=3000');$db->exec('SET SESSION lock_wait_timeout=3');
    $db->exec('SET SESSION innodb_lock_wait_timeout=3');
    $db->exec('SET SESSION TRANSACTION READ ONLY');return $db;
}

<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
function noa_bridge_pdo(): PDO {
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

<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
$n80=dirname(__DIR__).'/noa-app/engine/db.php';
require_once is_file($n80)?$n80:dirname(__DIR__).'/deploy/noa-app/engine/db.php';
unset($n80);
function noa_bridge_pdo(): PDO {return n80_db_connection();}

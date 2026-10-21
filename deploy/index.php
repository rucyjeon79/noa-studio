<?php
declare(strict_types=1);
// NOA STUDIO owns the root entrypoint; GnuBoard provides core services.
require_once __DIR__ . '/common.php';
if (!defined('_INDEX_')) { define('_INDEX_', true); }
require __DIR__ . '/noa-app/home.php';

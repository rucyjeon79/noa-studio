<?php
declare(strict_types=1);
require_once __DIR__.'/install.php';
function n80_app_update_status(string $root):array{return n80_install_update_status($root);}

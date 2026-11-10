<?php
declare(strict_types=1);
/** Legacy audit name delegates to N80 Guard. */
require_once __DIR__.'/guard.php';
require_once __DIR__.'/policy.php';
require_once __DIR__.'/readiness.php';
function n80_guardian_audit(string $root):array{return n80_guard_audit($root);}

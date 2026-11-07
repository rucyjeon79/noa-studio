<?php
declare(strict_types=1);
require '/tmp/noa-muvy-fixture/html/common.php';
require G5_PATH.'/noa-bridge/lab-core.php';require G5_PATH.'/noa-bridge/muvy-core.php';
while(true){$claim=mu_worker_claim();if($claim['task'])mu_finish($claim['task'],mu_fixture_provider($claim['task']));usleep(100000);}

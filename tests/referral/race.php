<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/referral-core.php';
$invite=nrf_invite(trim(file_get_contents(sys_get_temp_dir().'/nrf-ci-code')),time());nrf_complete('race_new',$invite,'2026-10-31 12:00:00');

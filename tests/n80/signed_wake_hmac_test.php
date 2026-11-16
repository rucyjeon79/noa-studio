<?php
declare(strict_types=1);
/**
 * N80 signed wake HMAC regression; isolated pure-function tests.
 * All keys/headers below are synthetic. No network, database, provider calls,
 * lock files, approval changes, scheduled tasks or process launches.
 */
require __DIR__.'/../../deploy/noa-app/engine/hub.php';
function check(bool $value,string $why):void {
    if(!$value)throw new RuntimeException('N80_WAKE_AUTH_TEST_FAILED: '.$why);
}
$key=str_repeat('a',64);
$raw='{"action":"scheduled_wake","operation":"ai.daily_shorts_clock","phase":"prepare","slot":"2026-11-18"}';
$ts='1795000000';
$nonce=str_repeat('b',32);
// This digest was independently generated (Python hashlib + hmac sha256).
$sig='c58f228c81d6515b1c27793e851a0c9641d9d46e9c6029c09ffccd85833616c9';
$headers=['time'=>$ts,'nonce'=>$nonce,'signature'=>$sig];
check(hash_hmac('sha256',"N80-HUB-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key)===$sig,'independent_test_vector');
check(n80_hub_auth($raw,$headers,$key,(int)$ts,512),'valid_signed_envelope');
check(!n80_hub_auth($raw.' ',$headers,$key,(int)$ts,512),'body_modified');
check(!n80_hub_auth(str_replace('prepare','publish',$raw),$headers,$key,(int)$ts,512),'phase_modified');
check(!n80_hub_auth($raw,$headers,str_repeat('c',64),(int)$ts,512),'wrong_key');
check(!n80_hub_auth($raw,$headers,'badkey',(int)$ts,512),'key_length');
check(!n80_hub_auth($raw,array_replace($headers,['nonce'=>str_repeat('c',32)]),$key,(int)$ts,512),'nonce_changed');
check(!n80_hub_auth($raw,array_replace($headers,['nonce'=>'invalid']),$key,(int)$ts,512),'nonce_format');
check(!n80_hub_auth($raw,array_replace($headers,['signature'=>str_repeat('0',64)]),$key,(int)$ts,512),'bad_signature');
check(!n80_hub_auth($raw,$headers,$key,(int)$ts+181,512),'stale_header');
check(!n80_hub_auth($raw,$headers,$key,(int)$ts-181,512),'future_header');
check(n80_hub_auth($raw,$headers,$key,(int)$ts+180,512),'valid_timestamp_boundary');
check(!n80_hub_auth($raw,$headers,$key,(int)$ts,64),'bounded_payload');
check(!n80_hub_auth($raw,$headers,$key,(int)$ts,12582913),'limit_must_be_bounded');
check(n80_host_load_policy()['githubWakeActivated']===false,'production_defaults_disabled');
check(n80_host_load_policy()['hostResidentRunnerAllowed']===false,'no_resident_fallback');
echo "N80_WAKE_HMAC_FIXTURE_PASS: 16 isolated assertions, no external actions\n";

<?php
/** Local member presentation only. No production session, database or payment service. */
require __DIR__.'/../desktop/fixture.php';
foreach (array_merge(glob('deploy/*.css'),glob('deploy/*.js')) as $file) copy($file,$root.'/'.basename($file));
foreach (['noa-settings.php','noa-sitemap.php','noa-ui-words.json'] as $file) copy('deploy/'.$file,$root.'/'.$file);
foreach (glob('public/noa-theme-scenes/*.webp') as $file) copy($file,$root.'/noa-assets/theme-'.basename($file));
echo "ROOM_MEMBER_PRESENTATION_FIXTURE_READY\n";

// Preserve the real MY view; replace only its database-backed gift count for this disposable fixture.
$my=file_get_contents($root.'/noa-my.php');
$my=str_replace("ng_available_count((string)\$member['mb_id'],time())",'0',$my);
file_put_contents($root.'/noa-my.php',$my);

// Feed the existing entitlement reader a local, read-only subscription row.
$common=file_get_contents($root.'/common.php');
$stub=<<<'PHP'
function sql_query($query,$error=true){if(!str_starts_with($query,'SELECT payload FROM noa_documents'))throw new RuntimeException('unexpected_fixture_query');return true;}
function sql_fetch_array($result){if(($_COOKIE['qa_role']??'')!=='vip')return false;return ['payload'=>json_encode(['ownerId'=>'fixture_vip','baseLevel'=>3,'status'=>'active','until'=>time()+86400*14])];}
PHP;
$common=str_replace("require __DIR__.'/extend/noa.access.php';",$stub."\nrequire __DIR__.'/extend/noa.access.php';",$common);
file_put_contents($root.'/common.php',$common);

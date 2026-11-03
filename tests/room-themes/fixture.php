<?php
/** Local member presentation only. No production session, database or payment service. */
require __DIR__.'/../desktop/fixture.php';
foreach (array_merge(glob('deploy/*.css'),glob('deploy/*.js')) as $file) copy($file,$root.'/'.basename($file));
foreach (['noa-settings.php','noa-sitemap.php','noa-ui-words.json'] as $file) copy('deploy/'.$file,$root.'/'.$file);
foreach (glob('public/noa-theme-scenes/*.webp') as $file) copy($file,$root.'/noa-assets/theme-'.basename($file));
echo "ROOM_MEMBER_PRESENTATION_FIXTURE_READY\n";

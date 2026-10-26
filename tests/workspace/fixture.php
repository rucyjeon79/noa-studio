<?php
require __DIR__.'/../navigation/fixture.php';
foreach(glob('bridge/*.php') as $file)copy($file,$root.'/noa-bridge/'.basename($file));
foreach(['noa-library.php','noa-workspace.php','noa-catalog.php','noa-catalog.js','noa-record-action.php','noa-inline-edit.php','noa-editor.php','noa-ai-lab.php','noa-ai-lab.js','noa-ai-lab.css','noa-workspace.js','noa-muvy-panel.php','noa-muvy.css','noa-muvy.js','noa-sitemap.php']as $file)copy('deploy/'.$file,$root.'/'.$file);
$common=file_get_contents($root.'/common.php');$common=str_replace("\$role=\$_COOKIE", "if((\$_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8079')\$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';\$role=\$_COOKIE",$common);file_put_contents($root.'/common.php',$common);
echo "WORKSPACE_HTTP_FIXTURE_READY\n";

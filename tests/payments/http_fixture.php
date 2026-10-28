<?php
require __DIR__.'/../subscription/native_fixture.php';
$site='/tmp/noa-toss-http/site';@mkdir($site.'/noa-bridge',0700,true);@mkdir(dirname($site).'/noa-private',0700,true);
foreach(['toss-config.php','toss-core.php','toss.php','toss-webhook.php','membership-core.php','monthly-rewards.php','member-access.php']as $f)copy('bridge/'.$f,$site.'/noa-bridge/'.$f);
file_put_contents($site.'/noa-bridge/subscription-core.php','<?php require_once '.var_export(realpath('bridge/subscription-core.php'),true).';');
copy('deploy/noa-payment-settings.php',$site.'/noa-payment-settings.php');
foreach(['noa-ui.css','noa-ui.js','noa-points.css','noa-design.json','noa-ui-words.json']as $f)copy('deploy/'.$f,$site.'/'.$f);
$native=realpath(__DIR__.'/../subscription/native_fixture.php');
file_put_contents($site.'/common.php','<?php session_start();require_once '.var_export($native,true).';$id=$_COOKIE["qa_toss_user"]??"";$member=$id?ns_one("SELECT * FROM g5_member WHERE mb_id=".ns_e($id)):[];$is_member=!!$member;$is_admin=$id==="tp_admin"?"super":"";if(($_SERVER["HTTP_ORIGIN"]??"")==="http://127.0.0.1:18090")$_SERVER["HTTP_ORIGIN"]="https://noastudio.ai.kr";');
ns_q("INSERT INTO g5_member VALUES ('tp_http',2,0),('tp_admin',10,0)");
file_put_contents($site.'/proof.php','<?php require __DIR__."/common.php";echo json_encode(["balance"=>get_point_sum("tp_http"),"orders"=>(int)ns_one("SELECT COUNT(*) AS n FROM noa_documents WHERE kind=\'toss_order\'")["n"]]);');
echo "TOSS_HTTP_FIXTURE_READY\n";

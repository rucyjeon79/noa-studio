<?php
require __DIR__.'/../voice/fixture.php';
foreach(['noa-home.js','noa-browse.js','noa-history.js','noa-engagement.js','noa-engagement.css','noa-world.css']as $file)copy('deploy/'.$file,$root.'/'.$file);
define('_GNUBOARD_',true);require_once 'bridge/home-discovery.php';
$candidates=[];for($i=0;$i<12;$i++)$candidates[]=['videoId'=>sprintf('video%06d',$i),'title'=>'EP.'.($i+1).' · '.(['하루의 끝에','난 다시 살아가','빛으로 널'][$i%3]),'views'=>100-$i,'score'=>100-$i,'publishedAt'=>gmdate('c',time()-86400*(12-$i)),'thumbnail'=>'/noa-assets/papa-logo.png','href'=>'/noa-youtube.php?track='.sprintf('video%06d',$i),'genre'=>'kpop-original'];
$data=['ok'=>true,'featured'=>array_slice($candidates,0,8),'ep'=>[],'stories'=>[],'covers'=>[],'playlists'=>[],'collectedAt'=>gmdate('c'),'discovery'=>nh_discovery_build($candidates,[],['video000005'=>1,'video000007'=>2],86400)];file_put_contents($root.'/discovery-fixture.json',json_encode($data));
$router=file_get_contents($root.'/router.php');$router=str_replace("if(\$path==='/noa2.php')", <<<'CODE'
if($path==='/noa-bridge/home.php'){header('Content-Type: application/json');readfile(__DIR__.'/discovery-fixture.json');return true;}
if($path==='/noa2.php')
CODE,$router);file_put_contents($root.'/router.php',$router);
// Actual world renderer with isolated source data, including the ACT layout from the report.
copy('deploy/noa-app/world-view.php',$root.'/noa-app/world-view.php');copy('bridge/world-story.php',$root.'/noa-bridge/world-story.php');copy('bridge/world-core.php',$root.'/noa-bridge/world-core.php');
file_put_contents($root.'/noa-world.php', <<<'CODE'
<?php require __DIR__.'/common.php';require __DIR__.'/noa-bridge/world-core.php';require __DIR__.'/noa-bridge/world-story.php';$selected=null;$tracks=[];$acts=[];$error=$mvError=$missing=false;$genre='kpop-original';$id='';$story=1;$episode=null;$world=['videos'=>[],'actCollection'=>['videos'=>[['act'=>1,'videoId'=>'video000001','title'=>'노아의 첫사랑 · ACT.1','thumbnail'=>'/noa-assets/papa-logo.png','description'=>'노아의 이야기']]]];require __DIR__.'/noa-app/world-view.php';
CODE);
// Use real row/widget construction with inert API read responses, no production mutations.
$html=file_get_contents(__DIR__.'/../engagement/fixture.php');$start=strpos($html,"<?php require __DIR__.'/common.php';?><!doctype");$end=strpos($html,"\nPHP;",$start);$layout=substr($html,$start,$end-$start);file_put_contents($root.'/rhythm-music.php',$layout);
$router=file_get_contents($root.'/router.php');$router=str_replace("if(\$path==='/noa2.php')", <<<'CODE'
if($path==='/noa-bridge/engagement.php'){header('Content-Type: application/json');$targets=json_decode($_GET['targets']??'[]',true);echo json_encode(['ok'=>true,'items'=>array_map(fn($t)=>$t+['likes'=>0,'comments'=>0,'liked'=>false,'reactionScore'=>0,'score'=>0],$targets)]);return true;}
if($path==='/noa2.php')
CODE,$router);file_put_contents($root.'/router.php',$router);
echo "SITE_RHYTHM_FIXTURE_READY\n";

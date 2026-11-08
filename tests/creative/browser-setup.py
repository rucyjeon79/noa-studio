from pathlib import Path
import os
site=Path(os.environ.get('NCD_SITE','/tmp/noa-creative-test/html'))
(site/'common.php').write_text('''<?php
define('_GNUBOARD_',true);session_start();$is_member=true;$is_admin='super';$member=['mb_id'=>'browser-owner','mb_level'=>10];$config=['cf_admin'=>'browser-owner'];
// Match the shared presentation injected by noa-design.extend.php in production.
ob_start(static fn($html)=>str_replace(['<html lang=', '</head>'],['<html data-noa-style="starlight" lang=', '<link rel="stylesheet" href="/noa-starlight.css"></head>'],$html));
''')
p=site/'noa-bridge/creative.php';s=p.read_text().replace('ncd_enqueue($db,$owner,$b)','ncd_enqueue($db,$owner,$b,static fn()=>204)');s=s.replace("error_log('[n80-creative] '.get_class($e))","error_log('[n80-creative] '.get_class($e).':'.$e->getMessage())");p.write_text(s)
(site/'creative-test-worker.php').write_text('''<?php
require __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-app/engine/creative.php';
header('Content-Type: application/json');$db=noa_bridge_pdo();$id=$_GET['id'];$job=ncd_job($db,$id);ncd_worker($db,'workerPoll',$id);$j=$job['document'];
if(($_GET['mode']??'')==='running'){echo json_encode(['ok'=>true]);exit;}
if(($_GET['mode']??'')==='failed'){echo json_encode(ncd_worker($db,'workerFail',$id,['reason'=>'generation_failed']));exit;}
if($j['operation']==='analyze'){$questions=[];foreach(NCD_CONDITIONS as $k)$questions[$k]=['prompt'=>$k.' 선택','options'=>['따뜻하고 담담한 선택','밝고 경쾌한 선택','쓸쓸하고 느린 선택','강렬하고 빠른 선택']];$result=['intent'=>[],'questions'=>$questions];}
else{$fields=[];foreach($j['targets'] as $k)$fields[$k]=$k==='creativeFields'?['storyPlan'=>'퇴근길 가족을 떠올리는 이야기']:($k==='title'?'집으로 가는 마음':$k.' 생성된 내용');$result=['fields'=>$fields,'vocal'=>'여자솔로'];}
echo json_encode(ncd_worker($db,'save',$id,['text'=>ncd_json($result)]));
''')
print('CREATIVE_HTTP_FIXTURE_READY')

# Real shared theme artwork is part of the browser fixture.
assets=site/'noa-assets';assets.mkdir(exist_ok=True)
import shutil
for scene in Path('public/noa-theme-scenes').glob('*.webp'):shutil.copyfile(scene,assets/('theme-'+scene.name))

shutil.copyfile('public/ainoa/ainoa-symbol.png',assets/'ainoa-symbol.png')

# Isolated, hash-verified media fixtures allow the one-button publication UI to use the real writer.
for name in ['fixture.mp3','fixture.webp']:shutil.copyfile(Path('tests/creative')/name,site/name)
(site/'creative-test-media.php').write_text('''<?php
require __DIR__.'/common.php';require __DIR__.'/noa-bridge/storage.php';require __DIR__.'/noa-bridge/sound-core.php';require __DIR__.'/noa-bridge/creative-publication.php';
$db=noa_bridge_pdo();$r=ncd_row($db,$_GET['id'],'browser-owner');$relative='creative-browser/'.$_GET['id'];$path=nj_private().'/media/'.$relative;if(!is_dir($path))mkdir($path,0700,true);
copy(__DIR__.'/fixture.mp3',$path.'/audio.mp3');copy(__DIR__.'/fixture.webp',$path.'/cover.webp');
$a=['song_key'=>$r['doc_key'],'source_url'=>'','suno_id'=>'','audio_path'=>$relative.'/audio.mp3','audio_bytes'=>filesize($path.'/audio.mp3'),'audio_sha256'=>hash_file('sha256',$path.'/audio.mp3'),'cover_path'=>$relative.'/cover.webp','cover_bytes'=>filesize($path.'/cover.webp'),'cover_sha256'=>hash_file('sha256',$path.'/cover.webp'),'status'=>'ready','source_evidence'=>'{}'];$cols=array_keys($a);$db->prepare('INSERT INTO noa_jukebox_assets (`'.implode('`,`',$cols).'`) VALUES ('.implode(',',array_fill(0,count($cols),'?')).')')->execute(array_values($a));
header('Content-Type: application/json');echo json_encode(['ok'=>ncd_assets($db,$r)['audioReady']]);
''')

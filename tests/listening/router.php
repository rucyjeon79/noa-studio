<?php
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(in_array($path,['/noa-bridge/listening.php','/noa-bridge/listening-weather.php','/noa-bridge/listening-care.php'],true)){
 session_start();define('_GNUBOARD_',true);$who=$_SERVER['HTTP_X_QA_USER']??'alice';$is_member=$who!=='guest';$level=str_starts_with($who,'level-')?(int)substr($who,6):($who==='video-member'?3:4);$member=$is_member?['mb_id'=>$who,'mb_level'=>$level]:[];$is_admin=$level===10?'super':'';
 // Only this isolated router uses a loopback origin; the production API keeps its exact HTTPS origin check.
 $src=file_get_contents($root.'/bridge/'.basename($path));$src=str_replace('https://noastudio.ai.kr','http://127.0.0.1:8137',$src);$src=str_replace("require_once dirname(__DIR__).'/common.php';",'',$src);$src=str_replace("dirname(__DIR__).'/noa-app/engine/personal-listening.php'",var_export($root.'/deploy/noa-app/engine/personal-listening.php',true),$src);$src=str_replace('__DIR__',var_export($root.'/bridge',true),$src);eval(substr($src,5));return;
}
if($path==='/'){
 echo '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-listening.css"><link rel="stylesheet" href="/noa-starlight.css"><script defer src="/noa-listening-model.js"></script><script defer src="/noa-listening.js"></script></head><body class="noa-page"><main><h1>NOA STUDIO</h1><a href="#noa-listening" data-noa-listen-now>내 음악 바로 듣기</a><section id="noa-listening" data-noa-listening="home"></section><section id="noa-daily-fortune" aria-labelledby="nl-fortune-heading" hidden></section></main></body></html>';return;
}
if($path==='/noa-lounge.php'){echo '<!doctype html><html lang="ko"><title>라운지</title><main>별무리 라운지</main></html>';return;}
if($path==='/noa-music.php'){
 define('_GNUBOARD_',true);$admin=false;$is_member=true;$is_admin='';$error=false;$collections=[];$jukebox=[];$genres=[];$musicAccess=['music'=>true,'premiumPlayback'=>true,'weatherVip'=>true];require_once $root.'/bridge/music-readmodel.php';
 function noa_music_e(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $fixtures=[['하루의 끝에','kpop-original',1],['작은 떨림','kpop-original',2],['마음결','kpop-original',3],['다른 장르','jpop-original',1],['달빛의 흐름','groovy-airy-pop',1],['새로운 밤','groovy-airy-pop',11],['당신의 하루','your-story',''],['다시 부르는 노래','cover-reborn','']];$songs=[];foreach($fixtures as $i=>[$title,$g,$ep]){$songs[]=['key'=>'single:'.$g.':'.sprintf('%02d',$i===3?1:$i+1),'title'=>$title,'genre'=>$g,'video'=>'','suno'=>'','audio'=>'/fixture.wav?track='.$i,'audioStatus'=>'ready','audioSha'=>'','audioBytes'=>0,'confirmed'=>true,'ep'=>(string)$ep,'act'=>'','kind'=>'single','rawLyrics'=>'','lyrics'=>'','description'=>'','cast'=>'female','vocal'=>'여자솔로','thumb'=>'/noa-assets/splash/kpop-original-g2-a.jpg','tracklist'=>'','originalArtist'=>'','moodScores'=>$g==='your-story'?[]:[['calm','calm','comfort','energy','focus','drive','calm','walk'][$i]=>5],'moodTags'=>$g==='your-story'?[]:['calm','energy','focus','comfort'],'registeredAt'=>1700000000+$i];}
 // A story with no mood metadata must be discoverable by its sung words.
 require_once $root.'/deploy/noa-app/engine/personal-listening.php';
 foreach ($songs as &$song) {
  if ($song['genre'] !== 'your-story') continue;
  $song['lyrics'] = '눈을 감고 잠시 쉬어 가. 오늘은 네 곁에 있을게.';
  $song['moodScores'] = n80_listening_mood_scores($song,[]);
  $song['moodTags'] = array_keys($song['moodScores']);
 }
 unset($song);
 if(($_SERVER['HTTP_X_QA_CATALOG']??'')==='large'){
  $template=$songs[0];$songs=[];
  foreach(['kpop-original','jpop-original','pop-original'] as $genre){
   for($n=1;$n<=96;$n++){$r=$template;$r['key']='single:'.$genre.':'.$n;$r['genre']=$genre;$r['title']=$genre.' '.$n;$r['moodScores']=[['calm','focus','energy','comfort','cruise','drive','walk','sleep'][($n-1)%8]=>8];$r['ep']=(string)$n;$r['audio']='/fixture.wav?record='.rawurlencode($r['key']);$songs[]=$r;}
  }
 }
 $src=str_replace('__DIR__',var_export($root.'/deploy',true),file_get_contents($root.'/deploy/noa-music.php'));
 $src=str_replace('</head>','<link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-policy-20261024.css"><script defer src="/noa-app/p0-player.js"></script></head>',$src);eval(substr($src,strpos($src,'?><!doctype html>')));return;
}
if($path==='/fixture.wav'){header('Content-Type: audio/wav');$data='';for($i=0;$i<16000*60;$i++)$data.=pack('v',(int)(sin($i*440*2*pi()/16000)*300)&65535);echo 'RIFF'.pack('V',36+strlen($data)).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($data)).$data;return;}
if(str_starts_with($path,'/noa-bridge/')){header('Content-Type: application/json');echo '{}';return;}
if($path==='/noa-music-detail.php'){header('Content-Type: application/json');echo json_encode(['key'=>$_GET['key'],'rawLyrics'=>'테스트 가사','description'=>'테스트 설명']);return;}
if(str_starts_with($path,'/noa-assets/')){$asset=realpath($root.'/public/'.substr($path,12));if($asset&&str_starts_with($asset,realpath($root.'/public').'/')&&is_file($asset)){header('Content-Type: '.(str_ends_with($asset,'.png')?'image/png':'image/jpeg'));readfile($asset);return;}}
$file=$root.'/deploy'.$path;if(is_file($file)){header('Content-Type: '.match(pathinfo($file,PATHINFO_EXTENSION)){'js'=>'application/javascript','css'=>'text/css','json'=>'application/json','jpg'=>'image/jpeg',default=>'application/octet-stream'});readfile($file);return;}
http_response_code(404);

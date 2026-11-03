<?php
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/listening.php'){
 session_start();define('_GNUBOARD_',true);$who=$_SERVER['HTTP_X_QA_USER']??'alice';$is_member=$who!=='guest';$member=$is_member?['mb_id'=>$who,'mb_level'=>4]:[];$is_admin='';
 $src=file_get_contents($root.'/bridge/listening.php');$src=str_replace("require_once dirname(__DIR__).'/common.php';",'',$src);$src=str_replace("dirname(__DIR__).'/noa-app/engine/personal-listening.php'",var_export($root.'/deploy/noa-app/engine/personal-listening.php',true),$src);$src=str_replace('__DIR__',var_export($root.'/bridge',true),$src);eval(substr($src,5));return;
}
if($path==='/'){
 echo '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-listening.css"><script defer src="/noa-listening-model.js"></script><script defer src="/noa-listening.js"></script></head><body class="noa-page"><main><h1>NOA STUDIO</h1><section id="noa-listening" data-noa-listening="home"></section></main></body></html>';return;
}
if($path==='/noa-music.php'){
 define('_GNUBOARD_',true);$admin=false;$is_member=true;$is_admin='';$error=false;$collections=[];$jukebox=[];$genres=[];$musicAccess=['music'=>true];require_once $root.'/bridge/music-readmodel.php';
 function noa_music_e(string $v):string{return htmlspecialchars($v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
 $songs=[];foreach(['하루의 끝에','작은 떨림','마음결','다른 장르'] as $i=>$title){$g=$i===3?'jpop-original':'kpop-original';$songs[]=['key'=>'single:'.$g.':'.sprintf('%02d',$i===3?1:$i+1),'title'=>$title,'genre'=>$g,'video'=>'','suno'=>'','audio'=>'/fixture.wav','audioStatus'=>'ready','audioSha'=>'','audioBytes'=>0,'confirmed'=>true,'ep'=>(string)($i+1),'act'=>'','kind'=>'single','rawLyrics'=>'','lyrics'=>'','description'=>'','cast'=>'female','vocal'=>'여자솔로','thumb'=>'/noa-assets/splash/kpop-original-g2-a.jpg','tracklist'=>'','originalArtist'=>'','moodTags'=>['calm','energy','focus','comfort'],'registeredAt'=>1700000000+$i];}
 $src=str_replace('__DIR__',var_export($root.'/deploy',true),file_get_contents($root.'/deploy/noa-music.php'));
 $src=str_replace('</head>','<link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-policy-20261024.css"><script defer src="/noa-app/p0-player.js"></script></head>',$src);eval(substr($src,strpos($src,'?><!doctype html>')));return;
}
if($path==='/fixture.wav'){header('Content-Type: audio/wav');$data='';for($i=0;$i<16000*60;$i++)$data.=pack('v',(int)(sin($i*440*2*pi()/16000)*300)&65535);echo 'RIFF'.pack('V',36+strlen($data)).'WAVEfmt '.pack('VvvVVvv',16,1,1,16000,32000,2,16).'data'.pack('V',strlen($data)).$data;return;}
if(str_starts_with($path,'/noa-bridge/')){header('Content-Type: application/json');echo '{}';return;}
if($path==='/noa-music-detail.php'){header('Content-Type: application/json');echo json_encode(['key'=>$_GET['key'],'rawLyrics'=>'테스트 가사','description'=>'테스트 설명']);return;}
$file=$root.'/deploy'.$path;if(is_file($file)){header('Content-Type: '.match(pathinfo($file,PATHINFO_EXTENSION)){'js'=>'application/javascript','css'=>'text/css','json'=>'application/json','jpg'=>'image/jpeg',default=>'application/octet-stream'});readfile($file);return;}
http_response_code(404);

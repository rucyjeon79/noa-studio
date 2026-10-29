<?php
declare(strict_types=1);
require __DIR__.'/../../bridge/world-core.php';require __DIR__.'/../../bridge/world-story.php';
function verify(bool $v,string $why):void{if(!$v)throw new RuntimeException($why);}
$story=(int)($argv[1]??0)?:null;$episode=null;$genre='kpop-original';$error=$mvError=$missing=false;$is_member=true;$is_admin='';$acts=[];$tracks=[];$selected=null;
$start=$story?($story-1)*10+1:1;
$world=['videos'=>[['videoId'=>'abcdefghij1','title'=>'A <script>alert(1)</script> song','thumbnail'=>'/cover.webp','storyAct'=>$story?:1,'ep'=>$start,'songId'=>'track-1','description'=>'Official','catalogActs'=>[]]],'actCollection'=>['videos'=>[]],'playlistUrl'=>'https://youtube.com/playlist?list=test'];
if($story){$selected=['fields'=>['worldPrologue'=>'등록된 프롤로그 원문','worldEpilogue'=>'등록된 에필로그 원문']];$tracks=[['song_id'=>'track-1','ep'=>$start,'fields'=>['title'=>'원본 곡 제목 <b>','worldChapter'=>'등록된 챕터 원문']]];}
ob_start();require __DIR__.'/../../deploy/noa-app/world-view.php';$html=ob_get_clean();
$dom=new DOMDocument();libxml_use_internal_errors(true);$dom->loadHTML('<?xml encoding="utf-8"?>'.$html);$xp=new DOMXPath($dom);
verify($xp->query('//h1')->length===1,'one page title');verify(!str_contains($html,'<script>alert(1)</script>'),'escape titles');verify(!str_contains($html,'noa-world-cast'),'duplicate cast removed');
foreach($xp->query('//a[starts-with(@href,"#")]') as $link){$id=substr($link->getAttribute('href'),1);verify($xp->query('//*[@id="'.$id.'"]')->length===1,'anchor '.$id);}
verify($xp->query('//*[@id="world-player"]')->length===1,'single player');
if($story){
 verify($xp->query('//article[contains(@class,"nw-chapter")]')->length===10,'ten chapters');
 verify(str_contains($html,'등록된 프롤로그 원문')&&str_contains($html,'등록된 에필로그 원문')&&str_contains($html,'등록된 챕터 원문'),'canonical story preserved');
 verify(!str_contains($xp->query('//*[@id="ep-'.$start.'"]')->item(0)->textContent,'감상 노트'),'official chapter has priority');
 verify(str_contains($html,nws_listening_note($start+1)),'distinct reading guide');
 verify(!str_contains($html,'\\n'),'no literal newline escape');
} else {verify($xp->query('//a[contains(@class,"nw-act-card")]')->length===4,'four story acts');verify(str_contains($html,'/noa-about.php'),'cast introduction link');}
verify(count(array_unique(array_map('nws_listening_note',range(1,40))))===40,'all reading notes distinct');
echo 'PASS WORLD '.($story?:'index').": canonical text, safe markup, real anchors, chapters and player\n";
// Private CI rendering artifact only; never install this harness on the production host.
if($dir=getenv('STARLIGHT_RENDER_DIR')){
 if(!is_dir($dir))mkdir($dir,0700,true);
 $preview=preg_replace('~<script\b[^>]*>.*?</script>|<link\b[^>]*rel="stylesheet"[^>]*>~s','',$html);
 $css=file_get_contents(__DIR__.'/../../deploy/noa-ui.css').file_get_contents(__DIR__.'/../../deploy/noa-world.css').file_get_contents(__DIR__.'/../../deploy/noa-starlight.css');
 $preview=str_replace('</head>','<style>'.$css.'html{--noa-rail:0px}body.nw-page main[data-world-editorial]{margin:0 auto}body{margin:0}</style></head>',$preview);
 $preview=str_replace('src="/cover.webp"','src="https://noastudio.ai.kr/noa-assets/editorial-starlight-studio.webp"',$preview);
 $preview=str_replace('src="/noa-assets/','src="https://noastudio.ai.kr/noa-assets/',$preview);
 file_put_contents($dir.'/world-'.($story?:'index').'.html',$preview);
}

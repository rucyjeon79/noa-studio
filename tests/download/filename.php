<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require __DIR__.'/../../deploy/noa-app/jukebox/core.php';
require __DIR__.'/../../bridge/music-download-core.php';
$genres=[
 'pop-original'=>'POP','panpop'=>'PAN','latin-afrobeats-edm'=>'LAE','edm-kpop-club'=>'ECR',
 'dreamy-deep-house'=>'DDH','your-story'=>'SM','groovy-airy-pop'=>'GAP','fantasy-ambient-edm'=>'FAE',
 'narrative-piano-indie'=>'NPI','thai-original'=>'Thai','echoes-of-joseon'=>'EJE',
 'jpop-original'=>'JPOP','kpop-original'=>'KPOP','joseon-ballad'=>'JB',
];
foreach($genres as $genre=>$code){
 $doc=['genreId'=>$genre,'title'=>'이전 제목','body'=>['confirmedTitle'=>'하루의 끝에']];
 foreach(['01','',0] as $ep){
  $want="[$code]".($ep==='01' && $code!=='SM'?'1_':'').'하루의 끝에.mp3';
  if(nmd_filename($doc+['ep'=>$ep])!==$want)throw new RuntimeException($want);
 }
}
if(nmd_filename(['genreId'=>'your-story','title'=>'그 이름 하나'])!=='[SM]그 이름 하나.mp3')throw new RuntimeException('Story filename');
if(nmd_filename(['genreId'=>'cover-reborn','title'=>'가/나'])!=='가_나.mp3')throw new RuntimeException('Unmapped genre');

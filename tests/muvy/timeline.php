<?php
declare(strict_types=1);
define('_GNUBOARD_',true);
require __DIR__.'/../../bridge/muvy-core.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function rejects(callable $fn):void{try{$fn();}catch(InvalidArgumentException|DomainException $e){return;}throw new RuntimeException('accepted invalid timeline');}
foreach([[180,1,26],[240,1,35],[300,1,43],[180,.5,24],[240,.5,32],[300,.5,40],[240,0,30],[8,1,1],[8.001,1,2],[.2,1,1],[211,1,30],[211.001,1,31],[3600,1,515]] as [$d,$o,$n]){
 $t=mu_timeline(['durationSeconds'=>$d,'overlapSeconds'=>$o]);check($t['cutCount']===$n,'cut count '.$d.'/'.$o);
 check(abs(end($t['scenes'])['end']-$d)<.00101,'exact song ending');
 check($t['scenes'][0]['start']==0,'zero start');
 $sum=0;foreach($t['scenes'] as $i=>$scene){check($scene['duration']>0&&$scene['duration']<=8,'bounded source');$sum+=$scene['duration'];if($i)check(abs($t['scenes'][$i-1]['end']-$scene['start']-$o)<.00001,'crossfade coverage');}
 check(abs($sum-($n-1)*$o-$d)<.00101,'no gap, fade durations not subtracted');
 check($n===1||8*($n-1)-$o*($n-2)<$d,'minimal cut count');
}
foreach([0,-1,INF,NAN,3601,'unknown'] as $d)rejects(fn()=>mu_timeline(['durationSeconds'=>$d]));
rejects(fn()=>mu_timeline(['durationSeconds'=>240,'overlapSeconds'=>8]));
$pack=mu_pack(['ep'=>'','title'=>'현재 확정 제목','lyrics'=>'전체 곡의 가사와 감정은 그대로 유지합니다.','song'=>['key'=>'song:current'],'timing'=>['durationSeconds'=>240]]);
$meta=['songType'=>'B','emotionalLine'=>'이야기','edition'=>'영화','genre'=>'POP','outfits'=>[1=>['woman'=>'coat','man'=>'shirt'],2=>['woman'=>'coat','man'=>'shirt'],3=>['woman'=>'coat','man'=>'shirt']]];
$calls=[];
while($next=mu_next_stage($pack)){
 [$stage,$batch]=$next;$calls[]=[$stage,$batch];[$system,$user,$tokens]=mu_prompt($pack,$stage,$batch,'');check($tokens<=6500,'bounded generation');
 if($stage==='script'){$out=$meta+['cuts'=>[]];$start=$batch*10;for($i=$start;$i<min($start+10,35);$i++)$out['cuts'][]=['n'=>$i+1,'lyric'=>'가사','script'=>'노아가 천천히 창밖을 바라본다.'];}
 elseif(preg_match('/^c([123])$/',$stage,$m)){$out=['cuts'=>[]];foreach(mu_chapter_cuts($pack,(int)$m[1],$batch) as $c)$out['cuts'][]=['n'=>$c['n'],'gemini'=>'same NOA','video'=>'8 seconds single continuous shot'];}
 else $out=['youtubeTitle'=>'현재 확정 제목','description'=>'설명','community'=>'글','thumbnailPrompt'=>'same NOA'];
 $pack=mu_apply($pack,$stage,$batch,$out);check(count($calls)<30,'bounded stage progress');
 // Serialization between every request models a closed tab / later resumption.
 $pack=mu_pack(json_decode(json_encode($pack,JSON_THROW_ON_ERROR),true));
}
check(count($pack['cuts'])===35&&count($calls)===14,'35 cuts survive batch and resume');
check(array_column($pack['cuts'],'n')===range(1,35),'ordered complete scenes');
check(array_reduce($pack['cuts'],fn($ok,$c)=>$ok&&$c['grok']!=='',true),'last short prompt batch present');
$legacy=$pack;unset($legacy['timing']);check(count(mu_pack($legacy)['cuts'])===35,'legacy saved work preserved');
$empty=$pack;$empty['cuts']=[];unset($empty['timing']);rejects(fn()=>mu_prompt($empty,'script',0,''));
$bad=$pack;$bad['cuts'][34]['n']=34;rejects(fn()=>mu_pack($bad));
rejects(fn()=>mu_apply($pack,'c3',2,['cuts'=>[]]));
echo "N80_DYNAMIC_SCENES_OK 3/4/5-minute coverage, crossfade boundaries, 35-cut batched resume, legacy retention\n";

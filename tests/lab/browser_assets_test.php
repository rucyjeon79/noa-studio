<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/noa-browser-'.bin2hex(random_bytes(8));
mkdir($root,0700);mkdir($root.'/html',0700);mkdir($root.'/noa-ai-lab',0700);mkdir($root.'/noa-ai-lab/jobs',0700);
define('_GNUBOARD_',true);define('G5_PATH',$root.'/html');
require __DIR__.'/../../bridge/lab-core.php';
require __DIR__.'/../../bridge/lab-browser-assets.php';
function ok(bool $v,string $why):void{if(!$v)throw new RuntimeException($why);}
function deny(callable $fn,string $why):void{try{$fn();}catch(Throwable $e){ok($e->getMessage()===$why,$e->getMessage().' != '.$why);return;}throw new RuntimeException('Accepted '.$why);}
try{
 $file=$argv[1];$probe=lab_browser_probe($file);ok($probe['width']===512&&$probe['height']===288,'native dimensions');
 ok($probe['duration']>0&&$probe['duration']<1,'native duration');ok(!$probe['checks']['decodedByServer'],'do not claim decode');
 $s=lab_defaults();$source='https://flow.google.com/project/11111111-1111-1111-1111-111111111111/edit/22222222-2222-2222-2222-222222222222';
 $input=['requestId'=>str_repeat('a',32),'sourceUrl'=>$source,'trackKey'=>'','sha256'=>hash_file('sha256',$file)];
 $receipt=lab_browser_import($s,$input,$file,'test');$id=$receipt['job']['id'];
 ok($receipt['fileVerified']&&count($s['jobs'])===1&&$s['jobs'][$id]['state']==='clip_ready','actual private result');
 ok(!isset($receipt['job']['browser']['receivedBy'])&&!isset($receipt['job']['browser']['fingerprint']),'private receipt metadata');
 ok($s['jobs'][$id]['settings']['posting']==='save'&&!isset($s['jobs'][$id]['lease']),'no independent worker or publication');
 ok(lab_browser_import($s,$input,$file,'test')['replayed'],'response replay');
 $again=$input;$again['requestId']=str_repeat('b',32);ok(lab_browser_import($s,$again,$file,'test')['job']['id']===$id,'cross-session exact result dedupe');
 $bad=$input;$bad['sha256']=str_repeat('0',64);deny(fn()=>lab_browser_import($s,$bad,$file,'test'),'clip_checksum_mismatch');
 foreach(['https://evil.example/clip.mp4',$source.'?token=secret','http://flow.google.com/clip',$source.'#x']as $url)deny(fn()=>lab_browser_source($url),'invalid_clip_source');
 $linked=$input;$linked['requestId']=str_repeat('c',32);$linked['trackKey']='story:fixture';$linked['sourceRevision']='2';
 $song=['key'=>'story:fixture','revision'=>3,'title'=>'현재 확정 제목','genre'=>'indie','cast'=>'female'];
 deny(fn()=>lab_browser_import($s,$linked,$file,'test',$song),'source_revision_conflict');
 $linked['sourceRevision']='3';$songBefore=$song;$saved=lab_browser_import($s,$linked,$file,'test',$song);
 ok($song===$songBefore&&$saved['job']['title']==='현재 확정 제목 · 제작 장면','current source is not overwritten');
 ok(count($s['jobs'])===2,'rejections leave no jobs');
 $badFile=$root.'/bad.mp4';file_put_contents($badFile,str_repeat('<html>not a video</html>',100));deny(fn()=>lab_browser_probe($badFile),'invalid_clip_container');
 file_put_contents($badFile,substr(file_get_contents($file),0,-20));deny(fn()=>lab_browser_probe($badFile),'invalid_clip_container');
 $stored=lab_job_dir($id).'/'.$s['jobs'][$id]['outputs'][0]['file'];file_put_contents($stored,'changed');
 deny(fn()=>lab_browser_import($s,$input,$file,'test'),'clip_checksum_mismatch');
 echo "N80 browser media: MP4 bounds, source version, private receipt, idempotency and tamper tests passed.\n";
}finally{foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $f){$f->isDir()?rmdir($f->getPathname()):unlink($f->getPathname());}rmdir($root);}

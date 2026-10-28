<?php
/** Protocol tests: no credentials, network, or production database. */
declare(strict_types=1);
define('_GNUBOARD_',true);define('NOA_DRIVE_TEST',true);
require dirname(__DIR__,2).'/deploy/noa-app/jukebox/drive-core.php';
function check(bool $ok,string $why):void{if(!$ok)throw new RuntimeException($why);}
function rejects(callable $fn,string $code):void{try{$fn();}catch(Throwable $e){check($e->getMessage()===$code,'expected '.$code.' got '.$e->getMessage());return;}throw new RuntimeException('missing rejection '.$code);}
function nj_private():string{return $GLOBALS['test_root'];}
function nu_dir(string $id):string{$p=nj_private().'/'.$id;if(!is_dir($p))mkdir($p,0700,true);return $p;}
function nu_row(PDO $db,string $id):array{return $GLOBALS['upload'];}
function nu_storage_error():DomainException{return new DomainException('test_storage_failure');}
class TestStatement extends PDOStatement{public function execute(?array $params=null):bool{return true;}}
class TestPDO extends PDO{public function __construct(){}public function prepare(string $query,array $options=[]):PDOStatement|false{return new TestStatement();}}
$GLOBALS['test_root']=sys_get_temp_dir().'/noa-drive-test-'.bin2hex(random_bytes(6));mkdir(nj_private(),0700);
$bytes='RIFF'.str_repeat("\0",4).'WAVE'.str_repeat('a',ND_CHUNK*2+511);
$u=['id'=>str_repeat('a',32),'status'=>'uploading','extension'=>'wav','file_bytes'=>strlen($bytes),'total_chunks'=>(int)ceil(strlen($bytes)/ND_CHUNK)];$GLOBALS['upload']=$u;
$remote='';$meta=[];$requests=[];$puts=0;$db=new TestPDO();
$GLOBALS['nd_http']=function($method,$url,$body,$headers)use(&$remote,&$meta,&$requests,&$puts,$u){
 $requests[]=$method;
 if(str_contains($url,'generateIds'))return ['code'=>200,'headers'=>[],'data'=>['ids'=>['driveFixture0123456789']]];
 if($method==='POST'){$meta=json_decode($body,true);return ['code'=>200,'headers'=>['location'=>'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture'],'data'=>[]];}
 if($method==='PUT'&&$body!==''){
  $range=current(array_filter($headers,fn($v)=>str_starts_with($v,'Content-Range: ')));
  check(preg_match('~bytes ([0-9]+)-([0-9]+)/([0-9]+)$~',$range,$m)===1,'valid byte range');
  check((int)$m[1]===strlen($remote)&&(int)$m[2]-(int)$m[1]+1===strlen($body),'no overlap or skipped bytes');
  ++$puts;
  // First request acknowledges only part. Second succeeds but loses its response.
  $remote.=$puts===1?substr($body,0,262144):$body;
  if($puts===2)throw new RuntimeException('simulated_lost_ack');
 }
 if(strlen($remote)===$u['file_bytes'])return ['code'=>200,'headers'=>[],'data'=>$meta+['size'=>strlen($remote),'sha256Checksum'=>hash('sha256',$remote)]];
 return ['code'=>308,'headers'=>strlen($remote)?['range'=>'bytes=0-'.(strlen($remote)-1)]:[],'data'=>[]];
};
try{
 check(nd_url('https://www.googleapis.com/upload/drive/v3/files?upload_id=ok'),'fixed Drive endpoint');
 foreach(['http://www.googleapis.com/drive/v3/files','https://www.googleapis.com.evil.test/drive/v3/files','https://user@www.googleapis.com/drive/v3/files','https://www.googleapis.com:8443/drive/v3/files','https://www.googleapis.com/oauth2/token']as$url)check(!nd_url($url),'reject untrusted endpoint');
 $first=substr($bytes,0,ND_CHUNK);
 rejects(fn()=>nd_chunk($db,$u,0,$first),'drive_transfer_retry');
 check(nd_state($u['id'])['received']===262144,'partial receipt persisted');
 check(nd_resume($u)['chunks']===[],'partial chunk is not acknowledged to browser');
 rejects(fn()=>nd_chunk($db,$u,0,$first),'simulated_lost_ack');
 $resume=nd_resume($u);check($resume['chunks']===[0],'lost acknowledgement reconciled');
 check($resume['chunkHashes']->{'0'}===hash('sha256',$first),'whole original chunk digest retained');
 $before=$puts;nd_chunk($db,$u,0,$first);check($puts===$before,'acknowledged chunk never retransmitted');
 rejects(fn()=>nd_chunk($db,$u,0,str_repeat('x',ND_CHUNK)),'chunk_conflict');
 rejects(fn()=>nd_chunk($db,$u,2,substr($bytes,ND_CHUNK*2)),'upload_incomplete');
 nd_chunk($db,$u,1,substr($bytes,ND_CHUNK,ND_CHUNK));nd_chunk($db,$u,2,substr($bytes,ND_CHUNK*2));
 check(nd_resume($u)['chunks']===[0,1,2]&&nd_state($u['id'])['complete'],'three chunks complete');
 check($remote===$bytes&&nd_state($u['id'])['sha256']===hash('sha256',$bytes),'final exact bytes and digest');
 check(!is_file(nu_dir($u['id']).'/input.audio')&&!glob(nu_dir($u['id']).'/chunk-*'),'no hosting audio files');
 $m=$meta+['size'=>strlen($bytes),'sha256Checksum'=>hash('sha256',$bytes)];
 foreach(['parents'=>['wrong-folder'],'id'=>'other-file','size'=>strlen($bytes)-1,'trashed'=>true,'appProperties'=>['noa_upload_id'=>'other-upload']]as$k=>$v)rejects(fn()=>nd_validate($u,array_replace($m,[$k=>$v])),'drive_source_verification_failed');
 rejects(fn()=>nd_accept($u,nd_state($u['id']),['code'=>404]),'drive_session_expired');
 echo "PASS Drive multi-chunk upload, partial receipt, lost response, exact resume, conflict and identity guards\n";
}finally{unset($GLOBALS['nd_http']);foreach(glob(nu_dir($u['id']).'/*')as$p)unlink($p);if(is_file(nu_dir($u['id']).'/.lock'))unlink(nu_dir($u['id']).'/.lock');rmdir(nu_dir($u['id']));rmdir(nj_private());}

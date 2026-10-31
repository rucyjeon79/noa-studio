<?php
declare(strict_types=1);
// Single content-bound publication. Replay returns the original post and attachment.
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_NOTICE_EXPIRY||!hash_equals('NOA_NOTICE_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();
try{
 $raw=file_get_contents('php://input');
 if(!hash_equals('NOA_NOTICE_PAYLOAD_SHA',hash('sha256',$raw)))throw new RuntimeException('unreviewed_payload');
 $p=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
 require_once dirname(__DIR__).'/common.php';
 require_once __DIR__.'/ecosystem-core.php';
 require_once __DIR__.'/membership-core.php';
 if(!nmb_rules())throw new RuntimeException('monthly_benefit_inactive');
 $id=eco_id($p['id']);$owner=(string)$config['cf_admin'];
 $admin=nr_member($owner,false);
 if((int)$admin['mb_level']!==10)throw new RuntimeException('publisher_unavailable');
 $actor=['id'=>$owner,'level'=>10,'name'=>'NOA STUDIO','admin'=>true];
 $image=base64_decode($p['image'],true);$info=$image!==false?getimagesizefromstring($image):false;
 if(!$info||$info[0]!==960||$info[1]!==540||$info['mime']!=='image/jpeg')throw new RuntimeException('invalid_illustration');
 $imageId=substr(hash('sha256',$image),0,32);$dir=G5_DATA_PATH.'/noa-ecosystem';
 if(!is_dir($dir)&&!mkdir($dir,0755,true)&&!is_dir($dir))throw new RuntimeException('asset_folder_unavailable');
 $path=$dir.'/'.$imageId.'.jpg';
 if(!is_file($path)){
  $tmp=tempnam($dir,'point-guide-');
  try{
   if(file_put_contents($tmp,$image)!==strlen($image)||!chmod($tmp,0644)||(!link($tmp,$path)&&!is_file($path)))throw new RuntimeException('asset_install_failed');
  }finally{if(is_file($tmp))unlink($tmp);}
 }
 if(!hash_equals(hash('sha256',$image),hash_file('sha256',$path)))throw new RuntimeException('existing_asset_preserved');
 $assetKey='ecosystem:asset:'.$imageId;
 ns_atomic($assetKey,false,function() use($assetKey,$imageId,$owner,$id){
  $a=ns_doc($assetKey,true);
  if(!$a){ns_put($assetKey,'ecosystem_asset',['id'=>$imageId,'owner'=>$owner,'mime'=>'image/jpeg','ext'=>'jpg','post'=>'','at'=>time()],0,$owner);return;}
  if($a['data']['owner']!==$owner||!in_array($a['data']['post']??'',['',$id],true))throw new RuntimeException('existing_asset_preserved');
 });
 $key='ecosystem:post:'.$id;$created=!ns_doc($key);
 if($created)eco_save($actor,['id'=>$id,'revision'=>0,'space'=>'lounge','category'=>'notice','title'=>$p['title'],'body'=>$p['body'],'images'=>[$imageId],'visibility'=>'public']);
 $post=eco_record($id,['id'=>'','admin'=>false,'level'=>1])['data'];
 if($post['title']!==$p['title']||$post['body']!==$p['body']||$post['owner']!==$owner||$post['images']!==[$imageId])throw new RuntimeException('existing_post_preserved');
 $result=['ok'=>true,'created'=>$created,'id'=>$id,'bodySha256'=>hash('sha256',$post['body']),'url'=>'https://noastudio.ai.kr/noa-lounge.php?post='.$id];
}catch(Throwable $e){http_response_code(500);$result=['ok'=>false,'error'=>$e instanceof mysqli_sql_exception?'database_error':$e->getMessage()];}
while(ob_get_level()>$level)ob_end_clean();
header('Content-Type: application/json; charset=utf-8');echo json_encode($result,JSON_UNESCAPED_UNICODE);

<?php
declare(strict_types=1);
/** Read-only local evidence; never downloads Drive data, changes state or starts work. */
function n80_hub_resident_retirement(string $root,?int $now=null):array {
 $now??=time();$names=['launch.mjs','runner.mjs','stop.mjs','probe.mjs'];
 $out=['state'=>'not_verified','displayState'=>'폐기 검증 대기','verified'=>false,
  'checkedAt'=>$now,'retiredAt'=>null,'files'=>[], 'runnerLockPresent'=>null,
  'driveReadbackVerified'=>false,'driveReadbackCheckedNow'=>false,
  'evidenceScope'=>'physical_files_and_saved_retirement_receipt',
  'processInventory'=>'not_available_via_hub','hostProcessesStarted'=>0];
 try{
  n80_hub_directory($root);$runtime=$root.'/runtime';
  if(!is_dir($runtime)||is_link($runtime)||realpath($runtime)!==$runtime)throw new RuntimeException('unsafe_runtime');
  clearstatcache();$listing=scandir($runtime);$rootListing=scandir($root);
  if(!is_array($listing)||!is_array($rootListing))throw new RuntimeException('directory_unreadable');
  $allAbsent=true;
  foreach($names as $name){
   $present=in_array($name,$listing,true);$p=$runtime.'/'.$name;$st=$present?lstat($p):false;
   if($present&&!is_array($st))throw new RuntimeException('entry_unreadable');
   $regular=$present&&($st['mode']&0170000)===0100000&&!is_link($p)&&$st['size']>0&&$st['size']<65536;
   $digest=$regular?hash_file('sha256',$p):null;
   if($regular&&!is_string($digest))throw new RuntimeException('file_unreadable');
   $out['files'][$name]=['present'=>$present,'safeRegularFile'=>$regular,'bytes'=>$regular?(int)$st['size']:0,'sha256'=>$digest];
   if($present)$allAbsent=false;
  }
  $out['runnerLockPresent']=in_array('runner.lock',$rootListing,true);
  $receipt=n80_hub_read($root,'resident-retirement.json');$control=n80_hub_read($root,'control.json');$status=n80_hub_read($root,'status.json');
  $removed=$receipt['deleted']??[];$sorted=$names;sort($sorted);
  if(!is_array($removed)||!array_is_list($removed))$removed=[];sort($removed);
  $at=$receipt['verifiedAt']??null;$backup=$receipt['backup']??[];
  $receiptValid=($receipt['state']??'')==='files_physically_removed'&&$removed===$sorted&&
   ($receipt['scriptSha256']??'')==='a3602950d15fbb5660004ed97cd6aa95c382f50230e4be3f8b25a8e9cb6cb3b6'&&
   ($receipt['driveByteReadbackVerified']??false)===true&&is_int($at)&&$at>0&&$at<=$now&&
   is_array($backup)&&($backup['provider']??'')==='google_drive'&&is_int($backup['bytes']??null)&&$backup['bytes']>0&&
   is_string($backup['sha256']??null)&&preg_match('/^[a-f0-9]{64}$/D',$backup['sha256'])===1&&
   is_string($backup['fileId']??null)&&preg_match('/^[A-Za-z0-9_-]{10,200}$/D',$backup['fileId'])===1;
  $beat=$status['heartbeatAt']??null;
  $idle=($control['stop']??null)===true&&($control['paused']??null)===true&&!$out['runnerLockPresent']&&
   is_int($beat)&&$beat>0&&$beat<$now-3600&&is_int($at)&&$beat<=$at;
  $out['driveReadbackVerified']=$receiptValid;
  if($receiptValid){$out['retiredAt']=$at;$out['archiveSha256']=$backup['sha256'];}
  if($receiptValid&&$allAbsent&&$idle){$out['state']='retired';$out['displayState']='폐기 완료';$out['verified']=true;}
  elseif($receiptValid){$out['state']='needs_review';$out['displayState']='폐기 상태 재확인 필요';}
 }catch(Throwable $e){$out['state']='unavailable';$out['displayState']='폐기 상태 조회 불가';$out['verified']=false;}
 return $out;
}

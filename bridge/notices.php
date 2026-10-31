<?php
declare(strict_types=1);
/** Read the existing notice board only; never seed posts or disclose secret/restricted content. */
function nn_plain(string $text):string {
 $text=preg_replace('~<(script|style)\b[^>]*>.*?</\1>~is','',$text);
 $text=preg_replace('~<(?:br\s*/?|/p|/div|/li)>~i',"\n",$text);
 return trim(html_entity_decode(strip_tags($text),ENT_QUOTES|ENT_HTML5,'UTF-8'));
}
function nn_project(array $rows):array {
 $items=[];
 foreach($rows as $row){
  if(count($items)>=5)break;
  if((int)($row['wr_is_comment']??0)!==0||preg_match('/(?:^|,)secret(?:,|$)/',(string)($row['wr_option']??''))||(int)($row['wr_id']??0)<1)continue;
  $body=nn_plain((string)($row['wr_content']??''));$title=nn_plain((string)($row['wr_subject']??''));
  $item=['id'=>(int)$row['wr_id'],'title'=>$title,'body'=>$body,'excerpt'=>mb_strimwidth(preg_replace('/\s+/u',' ',$body),0,150,'…','UTF-8'),'date'=>substr((string)($row['wr_datetime']??''),0,10)];
  // Only the reviewed guide file can supply markup to the public home projection.
  if($item['id']===1 && str_starts_with($title,'[이용안내]')){
   $guidePath=dirname(__DIR__).'/noa-app/welcome-guide.html';
   $guide=is_file($guidePath)?file_get_contents($guidePath):false;
   if(is_string($guide) && $guide===(string)$row['wr_content']){
    $item['welcomeGuide']=$guide;
    $item['excerpt']='음악 듣기 · 사연곡 신청 · 친구 초대 · AInoa 사용법';
   }
  }
  $items[]=$item;
 }
 return $items;
}
function nn_native_notices(?int $postId=null):array {
 global $g5,$member,$is_admin;
 $empty=['items'=>[],'restricted'=>false];
 if(!function_exists('sql_fetch')||!isset($g5['board_table'],$g5['group_table'],$g5['write_prefix']))return $empty;
 foreach([$g5['board_table'],$g5['group_table'],$g5['write_prefix'].'notice']as $table)if(!preg_match('/^[A-Za-z0-9_]+$/D',$table))return $empty;
 $board=sql_fetch("SELECT b.bo_list_level,b.bo_read_level,b.bo_use_cert,g.gr_use_access FROM {$g5['board_table']} b LEFT JOIN {$g5['group_table']} g ON g.gr_id=b.gr_id WHERE b.bo_table='notice'",false);
 if(!$board)return $empty;
 // Native group/certification requirements remain authoritative; this home projection fails closed.
 if(($is_admin??'')!=='super'&&((int)($member['mb_level']??1)<max((int)$board['bo_list_level'],(int)$board['bo_read_level'])||!empty($board['gr_use_access'])||!empty($board['bo_use_cert'])))return ['items'=>[],'restricted'=>true];
 $focus=$postId===null?'':' AND wr_id='.(int)$postId;
 $result=sql_query("SELECT wr_id,wr_subject,wr_content,wr_datetime,wr_option,wr_is_comment FROM {$g5['write_prefix']}notice WHERE wr_is_comment=0 AND FIND_IN_SET('secret',wr_option)=0{$focus} ORDER BY wr_id DESC LIMIT 5",false);
 if(!$result)return $empty;$rows=[];while($row=sql_fetch_array($result))$rows[]=$row;
 return ['items'=>nn_project($rows),'restricted'=>false];
}

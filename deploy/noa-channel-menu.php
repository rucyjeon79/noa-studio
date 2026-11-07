<?php
if(!defined('_GNUBOARD_'))exit;
function noa_channel_ai_button(array $access):void{
 static $loaded=false;static $count=0;$id='creator-ai-level-'.(++$count);
 if(!$loaded){$loaded=true;echo '<script src="/noa-channel-controls.js?v='.hash_file('sha256',__DIR__.'/noa-channel-controls.js').'" defer></script>';}
 if(!empty($access['creatorAI'])){echo '<a class="noa-button" href="/noa-ai-lab.php"><strong>AI LAB</strong><small>이용 권한 · 포인트 조건 확인</small></a>';return;}
 echo '<div class="creator-ai-access"><button class="noa-button" type="button" data-creator-ai-locked aria-describedby="'.$id.'"><strong>AI 생성</strong><small>8레벨 크레이터 VIP회원 전용 · 최고 관리자 이용 가능</small></button><p id="'.$id.'" role="status" aria-live="polite" hidden></p></div>';
}
function noa_channel_menu(array $access):void{
 require_once __DIR__.'/noa-app/engine/workspaces.php';
 ?><section class="noa-channel-menu" id="noa-my-channel"><h2>내 작업실</h2><nav aria-label="크리에이터 메뉴"><?php
 foreach(n80_workspaces() as $id=>$workspace){
  if($id==='admin'||empty($access[$workspace['access']]))continue;
  echo '<a href="'.$workspace['entry'].'"><strong>'.$workspace['label'].'</strong><small>'.($id==='creator_lab'?'곡·음원·채널 관리':'AI 제작·대화·음악 추천').'</small></a>';
 }
 ?></nav></section><?php
}

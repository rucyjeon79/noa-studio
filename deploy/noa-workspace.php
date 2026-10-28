<?php
declare(strict_types=1);
/** Shared task registry, included only by authenticated administrator pages. */
if(!defined('_GNUBOARD_')&&!defined('NOA_SITEMAP_REGISTRY_ONLY')){http_response_code(403);exit;}
function noa_workspace_groups():array{return [
 'content'=>['title'=>'콘텐츠 관리','intro'=>'등록한 곡을 찾고 고치거나, 감상 순서를 정리합니다.','routes'=>[
  ['catalog','곡 검색·수정·삭제','곡을 검색 → 수정 또는 휴지통으로 이동','/noa-catalog.php','library'],
  ['quality','곡정보 검사·정리','전체 검사 → 값 비교·확정 → 재검사','/noa-quality.php','settings'],
  ['editor','새 곡 등록','곡정보 항목 입력 → 저장 → 목록에서 확인','/noa-editor.php','edit'],
  ['order','곡 묶음·순서 관리','음원에서 카테고리·장르 선택 → 묶음 생성 또는 순서 저장','/noa-music.php','playlists'],
  ['trash','곡 휴지통','삭제한 곡을 확인 → 복원','/noa-catalog.php?view=trash','library'],
 ]],
 'creation'=>['title'=>'제작 작업실','intro'=>'가사·영상 제작과 완성 음원 업로드를 구분합니다.','routes'=>[
  ['jukebox','완성 음원 업로드','곡 선택 → MP3 업로드 → 최적화 완료 확인','/noa-app/jukebox/','music'],
  ['aiLab','AI 가사·뮤비 제작','제작 종류 선택 → 초안 검토 → 곡정보에 저장','/noa-ai-lab.php','mic'],
  ['youtubeAdmin','YouTube 채널 관리','채널 수집 → 원곡 연결 검토 → 성과 확인','/noa-youtube-admin.php','youtube'],
 ]],
 'operation'=>['title'=>'운영 설정','intro'=>'회원·게시판·화면·연결 정보를 관리합니다.','routes'=>[
  ['members','회원 관리','회원 상태와 권한 확인','/adm/member_list.php','user'],
  ['boards','게시판 관리','공지·커뮤니티 게시판 설정','/adm/board_list.php','community'],
  ['payments','토스 결제 연결','카드·카카오페이 키 등록과 테스트·운영 설정','/noa-payment-settings.php','settings'],
  ['subscriptions','구독·포인트 설정','이용 정책과 결제 내역 확인','/noa-subscription-admin.php','user'],
  ['themeAdmin','화면·테마 설정','공통 디자인과 테마 수정','/noa-theme-admin.php','settings'],
  ['social','Google·Kakao 가입 연결','신규 회원 가입용 인증 설정','/adm/config_form.php#anc_cf_sns','user'],
  ['aiSettings','AI·YouTube 연결 설정','제작 API·비용 한도·채널 소유자 인증','/noa-ai-lab.php#settings','settings'],
 ]],
 'advanced'=>['title'=>'고급 점검·데이터 복구','intro'=>'자료 연결에 문제가 있을 때 사용합니다. 일상적인 곡 수정은 콘텐츠 관리에서 합니다.','routes'=>[
  ['workStatus','N80 작업 현황','지시·단계·검증 결과 확인','/noa-work-status.php','settings'],
  ['catalogAdmin','원본 가져오기·통합 등록','이전 원본을 추가로 가져올 때 사용','/noa-catalog-admin.php','library'],
  ['documents','문서·변경 이력','문서 키와 저장 버전 확인','/noa-library.php?view=documents','book'],
  ['recovery','원본 복구','보존 자료와 복구 상태 확인','/noa-recovery.php','book'],
  ['database','데이터베이스 점검','운영 자료 관계와 저장 상태 확인','/noa-app/database/','library'],
  ['taxonomy','분류·제작 규칙','기존 장르의 분류 규칙과 제작 원칙 관리','/noa-app/taxonomy/','playlists'],
  ['popularity','인기 집계 점검','유효 재생과 순위 집계 확인','/noa-app/popularity/','playlists'],
  ['system','시스템 기본 설정','그누보드 기반 설정','/adm/config_form.php','settings'],
  ['nativeTheme','게시판 기반 테마','게시판 기반 테마 유지보수','/adm/theme.php','settings'],
 ]],
];}
function noa_workspace_render():void{
 foreach(noa_workspace_groups() as $id=>$group){if(in_array($id,['content','creation'],true))continue;if($id==='operation')array_unshift($group['routes'],['creatorReview','크리에이터 가입 심사','본인확인·신청 검토 → 승인·채널 개설','/noa-creator-review.php','user']);if($id==='advanced')$group['routes']=array_values(array_filter($group['routes'],fn($r)=>!in_array($r[0],['catalogAdmin','documents'],true)));$advanced=$id==='advanced';echo $advanced?'<details class="noa-workspace-advanced"><summary>'.htmlspecialchars($group['title']).'</summary>':'<section class="noa-section"><h2>'.htmlspecialchars($group['title']).'</h2>';
  echo '<p class="noa-muted">'.htmlspecialchars($group['intro']).'</p><nav class="noa-workspace-grid" aria-label="'.htmlspecialchars($group['title']).'">';
  foreach($group['routes'] as $r)echo '<a data-noa-icon="'.htmlspecialchars($r[4]).'" href="'.htmlspecialchars($r[3]).'"><span><strong>'.htmlspecialchars($r[1]).'</strong><small>'.htmlspecialchars($r[2]).'</small></span></a>';
  echo '</nav>'.($advanced?'</details>':'</section>');
 }
}

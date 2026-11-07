<?php
if(!defined('_GNUBOARD_')||empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit;}
?>
<section id="lab-muvy" class="lab-panel mu-desk" data-noa-document-link aria-labelledby="mu-heading">
<div class="mu-heading"><div><p class="noa-eyebrow">EP CINEMA / GROK</p><h2 id="mu-heading">뮤비 생성기</h2><p class="noa-muted">곡 탐색기에서 곡을 선택하면 저장된 곡정보로 30컷 대본, 챕터별 이미지·영상 프롬프트, 게시 문구를 차례로 생성합니다.</p></div><span class="mu-private">최고관리자 작업실</span></div>
<p id="mu-status" role="status" aria-live="polite">뮤비 작업실을 불러오는 중입니다.</p>
<details id="mu-picker" class="mu-picker" data-noa-disclosure><summary>곡 탐색기</summary>
<fieldset id="mu-picker-fields" class="lab-fields" disabled><label>제목·장르·EP 검색<input id="mu-search" type="search" autocomplete="off" placeholder="예: Afterglow 또는 EP.40"></label>
<label>제작할 곡<select id="mu-song"><option value="">곡 선택</option></select></label></fieldset>
<p id="mu-picker-state" class="noa-muted" role="status"></p><button type="button" id="mu-reload" hidden>목록 다시 불러오기</button>
<p class="noa-muted">곡을 선택하면 해당 곡정보를 Grok에 보내 제작을 시작합니다. 처음부터 모두 생성할 때는 최대 8회 요청합니다.</p></details>
<div class="mu-toolbar"><label>저장된 작업<select id="mu-project"><option value="">새 작업</option></select></label><button id="mu-new" type="button">새 작업</button><button id="mu-import" type="button">작업 가져오기</button><input id="mu-import-file" type="file" accept="application/json,.json" hidden><button id="mu-export" type="button" disabled>작업 파일 저장</button><button id="mu-text-export" type="button" disabled>제작 문서 받기</button></div>
<details class="mu-settings"><summary>Grok 연결 설정 <span id="mu-connection">확인 중</span></summary><form id="mu-config-form"><div class="lab-fields"><label>xAI 서비스 연결 키<input id="mu-key" type="password" autocomplete="new-password" placeholder="새로 연결하거나 변경할 때만 입력"></label><label>Grok 모델<input id="mu-model" value="grok-4.5" maxlength="80" required></label><label>하루 생성 요청 한도<input id="mu-limit" type="number" value="20" min="1" max="100" required></label><label class="lab-check"><input id="mu-enabled" type="checkbox">Grok 생성 사용</label></div><p class="noa-muted">키는 서버에 암호화해 저장합니다. 곡을 선택하거나 제작 단계를 실행하면 해당 곡정보와 대본을 xAI로 전송합니다. 이미지와 동영상은 완성된 프롬프트로 Gemini·Grok에서 제작합니다.</p><button type="submit">연결 설정 저장</button></form></details>
<form id="mu-input-form"><p id="mu-source" class="noa-muted" hidden></p><div class="lab-fields"><label>EP 번호<input id="mu-ep" maxlength="40" placeholder="EP.12" required></label><label>곡 제목<input id="mu-title" maxlength="120" required></label><label class="lab-wide">가사<textarea id="mu-lyrics" maxlength="12000" minlength="10" rows="8" required></textarea></label></div><div class="mu-toolbar"><button type="submit" id="mu-save">작업 저장</button><span id="mu-save-state" class="noa-muted"></span></div></form>
<nav class="mu-steps" aria-label="뮤비 제작 단계"><button type="button" data-mu-step="script">01 · 30컷 대본</button><button type="button" data-mu-step="c1">02 · 챕터 1</button><button type="button" data-mu-step="c2">03 · 챕터 2</button><button type="button" data-mu-step="c3">04 · 챕터 3</button><button type="button" data-mu-step="publish">05 · 게시 문구</button></nav>
<div id="mu-result"><p class="noa-muted">곡 탐색기에서 제작할 곡을 선택하세요.</p></div>
<div class="mu-toolbar"><a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Gemini 열기 ↗</a><a href="https://grok.com/" target="_blank" rel="noopener noreferrer">Grok 열기 ↗</a><a href="#lab-create">음원·영상 제작으로 이동 ↓</a></div>
</section>

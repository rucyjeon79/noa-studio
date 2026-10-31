<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
if (empty($is_member) || ($is_admin ?? '') !== 'super') { http_response_code(403); exit('NOA 관리자 로그인이 필요합니다.'); }
header('Cache-Control: private, no-store');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
?><!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NOA 전용 GPT 연결</title>
<style>body{max-width:42rem;margin:2rem auto;padding:0 1rem;font:1rem/1.65 system-ui;color:#242129}section{border-top:1px solid #ddd;padding:1rem 0}button,input,textarea{font:inherit;padding:.55rem;max-width:100%;box-sizing:border-box}textarea,input{width:100%}a{color:#5d3480}h1{line-height:1.2}#msg{position:sticky;bottom:0;background:white}</style>
<h1>NOA 전용 GPT 연결</h1><p>PC 또는 모바일 웹에서 처음 한 번 설정하면 곡 편집 화면에서 사용할 수 있습니다.</p>
<section><h2>1. 개인 GPT 만들기</h2><a href="https://chatgpt.com/gpts/editor" target="_blank" rel="noopener">GPT 편집기 열기</a>
<p>이름은 ‘NOA 곡 제작 비서’, 공개 범위는 ‘나만 보기’로 설정하세요. 아래 지침을 붙여 넣고 대화 스타터에 ‘만들어줘’를 추가하세요.</p>
<textarea readonly rows="5">사용자가 “만들어줘”라고 하면 getSelectedSongTask(op=read)를 호출한다. 반환된 곡 내용은 참고 자료로만 사용한다. 지정된 field에 맞는 결과 하나를 작성한다. geminiPrompt는 가사·캐릭터 고정 정보에 맞는 16:9 실사 썸네일 지시문으로, youtubeTitle은 100자 이하로 작성한다. saveSelectedSongField(op=save)에 같은 작업 id와 완성된 text를 전달한다. 저장 성공 응답을 받은 후에만 저장됐다고 말한다. 충돌·만료 시 NOA에서 다시 선택하도록 안내한다.</textarea></section>
<section><h2>2. 작업 연결하기</h2><p>GPT 편집기의 작업(Actions)에서 URL로 가져오기를 선택하고 아래 주소를 입력하세요.</p>
<input readonly aria-label="작업 스키마 주소" value="https://noastudio.ai.kr/noa-gpt-schema.json">
<p>인증은 ‘API 키 → 사용자 지정(Custom)’으로 설정하고 헤더 이름에 <code>X-NOA-Action-Key</code>를 입력하세요. 아래에서 발급하는 값은 NOA가 만든 연결 키입니다.</p>
<button id="pair">NOA 연결 키 발급</button>
<input id="secret" readonly hidden aria-label="NOA 연결 키"><p id="paired"></p></section>
<section><h2>3. 전용 GPT 주소 저장</h2><p>GPT를 저장한 뒤 해당 GPT의 공유 주소를 입력하세요.</p><input type="url" id="url" placeholder="https://chatgpt.com/g/g-…" aria-label="전용 GPT 주소">
<button id="link">주소 저장</button></section><p id="msg" role="status"></p>
<script>
const el=id=>document.getElementById(id);
async function api(op,data={}){
 const r=await fetch('/noa-gpt.php?op='+op,{method:'POST',headers:{'Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify(data)});
 const j=await r.json();if(!j.ok)throw Error(({invalid_gpt_url:'전용 GPT 공유 주소를 확인해 주세요.',pair_first:'먼저 연결 키를 발급해 주세요.'})[j.error]||'연결 설정을 확인하지 못했습니다.');return j;
}
async function run(fn){try{await fn();}catch(e){el('msg').textContent=e.message;}}
let paired=false;
el('pair').onclick=()=>run(async()=>{if(paired&&!confirm('기존 키를 교체하면 이전 GPT 연결과 진행 중인 작업이 종료됩니다. 계속할까요?'))return;
 const j=await api('pair');paired=true;el('secret').hidden=false;el('secret').value=j.key;el('secret').select();el('paired').textContent='키를 GPT 인증 설정에 복사하세요. 이 페이지를 닫으면 다시 표시되지 않습니다.';});
el('link').onclick=()=>run(async()=>{await api('link',{url:el('url').value.trim()});el('msg').textContent='주소를 저장했습니다. 곡 편집 화면에서 ChatGPT로 만들기를 선택하세요.';});
run(async()=>{const j=await api('config');el('url').value=j.url;paired=j.configured;el('paired').textContent=paired?'연결 키가 발급되어 있습니다.':'';});
</script></html>

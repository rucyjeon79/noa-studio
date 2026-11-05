import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('deploy/noa-ui.js','utf8');
const registry=source.slice(source.indexOf('const icons='),source.indexOf('let access='));
const classifiers=source.slice(source.indexOf('function icon(key)'),source.indexOf('// Action footers'));
const {actionIcon,headingIcon,icon,icons}=vm.runInNewContext(registry+classifiers+';({actionIcon,headingIcon,icon,icons})');
const control=(text,href='',aria='')=>({textContent:text,getAttribute:k=>k==='href'?href:k==='aria-label'?aria:null});
test('different operations have different silhouettes even when their subject is a song or purchase',()=>{
 const cases=[['곡 저장','save'],['곡 정보 수정','edit'],['링크 공유','share'],['장바구니에 담기','cart'],['결제하기','card'],['포인트 충전','wallet'],['친구에게 선물','gift'],['내 활동·알림','bell'],['곡 듣기','play'],['일시정지','pause'],['곡 다운로드','download'],['파일 업로드','upload'],['링크 복사','copy'],['저장한 라운지 글','bookmark'],['새 목록 만들기','plus'],['목록형','list'],['앨범형','disc'],['추천 설정','settings'],['검색','search'],['보내기','mail'],['글 삭제','trash'],['로그인','login'],['로그아웃','logout'],['다음','forward'],['이전','back'],['닫기','close'],['좋아요','heart'],['신고','flag'],['선택 상품 비교','compare']];
 for(const [text,key]of cases){assert.equal(actionIcon(control(text)),key,text);assert.match(icon(key),/aria-hidden="true"/);}
 assert.equal(new Set(cases.map(([,key])=>icons[key])).size,cases.length);
});
test('unknown text does not inherit a bookshelf or music decoration',()=>{
 assert.equal(actionIcon(control('별 하나가 모이면')), '');assert.equal(headingIcon('좋은 하루를 함께'),'');assert.equal(icon('unknown'),'');
 assert.equal(actionIcon(control('음악 듣기 ↗','/noa-music.php')),'play');
 assert.equal(actionIcon(control('별무리 이야기','/bbs/board.php?bo_table=free')),'community');
 assert.equal(headingIcon('별무리 라운지'),'community');assert.equal(headingIcon('포인트 충전'),'wallet');
 assert.equal(actionIcon(control('','', '게시판 검색')),'search');
});

test('a composite notification card uses its primary label, not verbs in the description',()=>{
 const card={...control('도착한 소식 새 글과 댓글·답글, 반응을 확인하세요.','/noa-notifications.php'),querySelector:()=>({textContent:'도착한 소식'})};
 assert.equal(actionIcon(card),'bell');
});

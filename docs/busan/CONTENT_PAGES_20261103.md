# 부산지부 안내 페이지 개편 · 2026-11-03

## 대상

정식 `https://skhnslu-busan.com/bbs/content.php?co_id=` 뒤에 company / slogan / privacy / provision. 중복 company는 동일 페이지로 처리.

- 소개: 기존 이미지 4장을 직접 확인해 권리·존엄·단결·투쟁, 현장 노동자의 연결과 참여라는 기존 메시지를 의미 기반 HTML로 재작성. 가입→조직부장 승인→참여 안내와 공식 질의 경로 보완.
- 비전: 기존 이미지 5장을 확인해 화합·도전·공유 및 ‘사람을 잇고, 현장을 묶고, 투쟁을 연결한다.’ 보존. 모바일 문단/단계/가치별 구성으로 정리.
- 개인정보/약관: 매 요청마다 native `$str`를 받아 조항과 시행일을 그대로 유지. 인라인 글꼴·색상 제거, semantic section/목차/문의 링크 적용. 관리자 최신 수정이 즉시 반영되며 복제 원문으로 덮어쓰지 않음.
- 약관 아래의 별도 현재 이용 안내: 가입 승인, 부산지부ON 평일 09–18, 사용 전 포인트 확인 및 실제 정산, 알림 허용/지도 연결, 개인정보 입력 금지 및 조직부장 경유 안내. 기존 조항 자체를 개정한 것으로 표시하지 않음.
- 개인정보 보호책임자 실명/전화, 보존 기간 등 확인되지 않은 운영 사실을 만들지 않음. 기존 법률 조항을 유지했으므로 법적 정합성 전체 재검토를 완료했다는 뜻이 아님.

## 테마·접근성

기존 자동09/18 및 수동 라이트/다크 시스템과 동일 토큰·4종 WebP 공유. 소개/약관 hero 장면, 비전/개인정보 nature 장면. 키보드 focus, aria-current, 문서별 목차, 44px 주요 버튼, 모바일 2열→1열 문단 구성. 원문은 이미지가 아닌 읽고 선택·검색할 수 있는 텍스트.

## 구현

- `busan-assistant/content-pages/render.php`
- `busan-assistant/content-pages/content-pages.css?v=20261103-1`
- `extend/busan-content.extend.php`
- `skin/content/basic/content.skin.php`
- `mobile/skin/content/basic/content.skin.php`
- `theme/UXC_Flarumix/skin/content/basic/content.skin.php`

마지막 3개는 네 co_id와 활성화 상수에 한해 새 renderer를 부르는 짧은 guard만 추가. 다른 내용관리·관리자 수정 버튼·회원/게시판 기능 유지. Native core bbs/content.php와 SQL은 수정하지 않음. 기존 원본은 부산지부 private 0600 보존, 선행 전체 해시 확인 및 원자적 교체, extension 마지막 활성화.

예전 rucyjeon79.dothome.co.kr 호스트의 4개 content GET/HEAD만 고정 allowlist로 정식 도메인 동일 co_id에302 연결. 임의 redirect destination을 입력받지 않음. 다른 페이지나 로그인 요청은 변경하지 않음.

## 검증

- read-only native template inspection run41597001965 success.
- deploy run41597906601 / job125789488943 success.
- PHP8.2 syntax/DOM test: 4개 페이지×native desktop/mobile/theme 진입, 법률 원문 전체 텍스트와 기존2026-02-01시행일 보존, 최신 native 수정 반영, active navigation, 스크립트/인라인 핸들러 차단, 다른 co_id 원래 출력 보존 통과.
- 운영6개 파일 업로드 대조 통과. 정식4페이지 본문/스타일/테마 이미지와 legacy4주소 redirect 실제 HTTP 확인.
- 브라우저: 소개 light, 개인정보 light 및 목차 실제 이동(`#bp-clause-8`, top75.6), 약관14개 section/별도 서비스 안내, 비전 dark 및 nature-dark WebP 로드 확인. 개인정보12개 section. 모두 desktop1363px에서 가로 넘침 없음.
- 실제 휴대폰 시각 검증은 미실시. 반응형 스타일과 native mobile skin 통합은 구현·자동 검사 완료.

## 사용자 피드백 반영: 원본 이미지 복원

사용자가 이미지 전부를 텍스트로 바꾼 방식에 이의를 제기하여 v20261103-2에서 소개4장·비전5장 원본 이미지를 모두 원래 순서로 다시 표시. 테마 배너/내비/읽기 쉬운 본문은 유지하고 문맥별 섹션에 원본 figure를 함께 배치. 원본 파일 삭제·수정 없음, 공식 HTTPS 동일파일 참조. 이미지 고유 비율/내용 유지, width100% heightauto 및 lazy loading, 의미 있는 alt 제공.

run41610135467 / job125829670758 성공. 네 페이지 테스트와 원본4/5장 개수 확인, 원본9개 이미지 HTTP 접근/Content-Type 검증 통과. 실제 브라우저에서 소개4장 DOM 및 현재 화면 이미지 로드, 가로 넘침 없음 확인. 향후 디자인 수정은 기존 이미지의 장점을 보존하며 진행.

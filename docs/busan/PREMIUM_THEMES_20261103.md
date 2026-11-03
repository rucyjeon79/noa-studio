# 부산지부 프리미엄 테마 · 2026-11-03

## 확정 컨셉

- 다크: 하루를 마친 조합원의 쉼. 밤바다, 별빛, 달빛. 네이비 표면, 달빛 실버, 절제한 별빛 골드.
- 라이트: 활기찬 일상과 가족 휴가. 햇빛, 바다, 산. 화이트 표면, 오션 블루, 소나무 그린, 햇빛 골드.
- 기본 자동: 매일 한국시간 09:00 이상 18:00 미만 라이트, 나머지 다크. AI 이용 시간 정책과는 별개이며 주말에도 동일.
- 헤더 테마 버튼: 자동/라이트/다크 명시 선택. 새 preference key가 없으면 기존 legacy 값에 관계없이 자동 시작. 이후 수동 선택은 유지.
- 첫 head 실행, 경계 시각 timer, 화면 복귀/포커스/pageshow, 다른 탭 storage 변경에 대응. native darkMode/data-theme/editor 테마 동기화.
- 메인 슬로건 ‘우리의 도전은 권리를 향한다.’ 유지. 테마별 설명문 변경.
- 공지/권리/자료는 조합원·가족 이미지, 자유/휴식/활동 게시판은 자연 풍경 이미지로 구분. 기존 이미지 1장뿐인 legacy 게시판 상단만 교체하며 혼합 안내문·게시글·관리자가 새로 등록한 슬라이드는 유지.

## 배포 범위

기존 `.github/workflows/busan-banners.yml`의 독립된 배너 배포 경로를 사용. ZIP은 `deploy/busan/premium-theme-20261103.zip.b64`에 보관하며 workflow 본문과 분리.

- `extend/busan-banner.extend.php`
- `busan-assistant/banner-assets/busan-theme.js`
- `busan-assistant/banner-assets/busan-premium-theme.css`
- 기존 `busan-banners.css`, 원래 slider PHP와 기존 WebP는 동일 내용 유지
- 신규 WebP 4개: `busan-{hero,nature}-{light,dark}-20261103.webp`

닷홈 부산지부 계정만 접근. whole-file 선행 해시 대조, 원자적 업로드, extension 마지막 활성화. 회원/게시글/설정 SQL 변경 없음. NOA STUDIO 파일 변경 없음.

## 이미지

내장 imagegen 사용. 외부 API 키/CLI 이용 없음. 2172×724 원본 생성 후 1800×600 WebP 품질 75로 변환. 실제 조합원 촬영 사진으로 소개하지 않음. 생성 결과는 프로젝트에 WebP로 보존.

Prompt set (photorealistic-natural, panoramic website background, no text/logos/UI/watermark):

1. Hero dark: Korean home-service field worker after the workday, unbranded navy jacket, seen from behind on a waterfront bench at right, quiet Busan coast, modest stars and crescent moon, silver reflection, left 55% uncluttered deep navy sky/sea for HTML text. Calm dignified editorial photography.
2. Hero light: Korean family of four, adults and school-age children, candid walk on a safe public coastal path at right, Busan sea and green pine-covered mountains, late morning sunlight, left 55% pale uncluttered sky and turquoise sea for HTML dark navy copy. Warm restrained editorial photography.
3. Nature dark: serene pine-covered coastal mountain ridge and tranquil sea under a modest starry night, silver reflected water, distant coastal lights, no people, left 60% uncluttered dark sky/sea, calm realistic night exposure.
4. Nature light: luminous pine woodland coastal trail overlooking blue Busan sea, natural late morning sun, inviting path on right, no people, left 60% soft low-detail pale foliage/sky/sea. Balanced ocean blue, pine green and sunlight gold.

## 검증

- Node syntax check, jsdom test: Seoul 09/18 exact boundaries, weekend schedule, live timer switch, auto default, manual persistence, BFCache/pageshow/storage, image source switching, editor theme, keyboard Escape and storage unavailable fallback passed locally.
- CI PHP checks: main slider actual rendering, preserved links/new admin slides/mixed content, unsafe title escaping and theme image pairs.
- Deployment and live visual verification tracked in Actions. Do not treat generated art alone as deployment completion.

## 최종 운영 확인

- v20261103-2 배포 run41594775437 / job125779453878 성공. PHP 렌더링·Node 테마 테스트 통과, 운영 10개 파일 무결성 및 새 WebP 4개 실제 HTTP 응답 대조 성공.
- 브라우저에서 자동(라이트) 기본값, 수동 다크 전환, 테마별 문구·이미지 로드, 수동 선택 재방문 유지, 자동으로 복원 확인.
- 기존 :root.darkMode보다 높은 우선순위로 토큰을 적용해 헤더/내비/본문/카드/검색 버튼의 이전 보라색 스타일을 달빛 골드로 일관화.
- 최종 다크 header rgb(18,31,49), prime #dcc997. 라이트/다크 페이지 가로 넘침 없음(1363px 데스크톱). 다크 로고 글자 표시 확인.
- 챗비서 다크 dialog 배경 rgb(17,27,43), 글자 rgb(240,245,251) 확인. AI 호출·포인트 사용 없이 표시만 점검.
- 권리 노트는 비회원 열람 제한과 로그인 이동 유지. 로그인된 게시판의 실제 시각 검증은 미실시, PHP 템플릿·이미지 로드는 자동 검증 완료.
- 모바일 media CSS 포함. 현재 브라우저는 데스크톱 뷰포트여서 실제 휴대폰 시각 확인은 별도 필요.

## 정렬 보정 · v20261103-4

- 최종 run41595899796 / job125783063130 성공. 전체 기존 PHP/테마 테스트와 운영 자산 확인 통과.
- 페이지 바깥 여백 desktop24/mobile16px, 카드 안쪽 desktop20/mobile16px, 열 간격24px, 구역 간격 desktop32/mobile24px, 공통 버튼 높이44px.
- 배너 문구·버튼·서명 시작선40px(모바일24px), 게시판 배너32px(모바일24px). 모바일 헤더의 기존 중복10px 패딩 제거, 로고 축소 대응.
- 동일 행 카드 상단·너비 정렬, 관련 카드 높이 일치. 포인트 랭킹과 짧은 추천 목록처럼 데이터량이 다른 행은 불필요한 빈 높이를 만들지 않음.
- 운영 desktop1363px 실측: hero/card x=336, copy x337+padding40=signature x377, 카드 너비484.5px 동일, 열 간격24px, 구역 간격32px, 카드 안쪽20px, header36px+하단간격12px. 가로 넘침 없음. 라이트/다크 확인 후 자동 선택 복원.
- 모바일 배너 사진은 하단47% 영역으로 배치해 문구·가족/조합원 피사체의 겹침 완화. 실제 휴대폰 시각 점검은 별도 필요.

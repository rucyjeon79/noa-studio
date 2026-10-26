# 2026-10-27 카테고리·통합 라이브러리·최고관리자 작업실 반영 결과

초기 배포 이후 곡정보의 실제 표시 경로 누락을 확인해 아래와 같이 추가 보완했다. 초기 운영 적용 커밋은 `afa0951041518c1074bcdafab411482f4959f017`, 완료 시각은 한국시간 2026-10-27 08:26이다.

## 곡정보 상단 누락 보완 · 2026-10-27 08:53 KST

사용자의 후속 지적으로 초기 완료 보고에 누락이 있었음을 확인했다. 음원 분류는 숨겨진 기존 상세 영역에 붙어 있었으며, 곡 직접 링크에서는 지연 로드되는 공통 스크립트보다 먼저 렌더링을 시도했다. 기존 검사의 음원 페이지는 간략한 임시 페이지여서 이 표시 경로를 검증하지 못했다. 내 채널 곡정보에도 분류 표시가 빠져 있었다.

- 선택한 곡의 제목 위에 보이는 정보 영역을 두고 4단 분류를 표시한다. 직접 링크·곡 변경·수정 저장 후 갱신을 연결했다.
- 내 채널 곡정보에도 공통 분류를 적용하고 장르·제목 변경 시 갱신한다. 320px 업로드 영역의 가로 넘침도 수정했다.
- 실제 배포 PHP를 분리된 MySQL/로그인 환경에서 렌더링하도록 검사를 보강했다. 320·390·1280px, 다크·아이보리에서 네 단계의 **가시성**, 제목 위 배치, 직접 링크·곡 전환·인라인/독립 편집·내 채널 표시를 모두 통과했다. 모바일·PC 스크린샷을 직접 검토했다.
- 재생·업로드 코드의 기존 SHA 보존 기준은 변경하지 않았다. 표시 함수 호출만 보존 검사에서 분리했고 7개 검사 통과. [기존 기능 검사](https://github.com/rucyjeon79/noa-studio/actions/runs/40422318577)도 성공했다.
- [배포 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40422318567)의 candidate·production 모두 성공. 운영 커밋은 `285b50925e2be74440fa43c4c727209b09404f72`. 변경 파일은 `noa-music.php`, `noa-ui.css`, `noa-creator.php/js/css` 5개이며 30개 대상 해시 일치와 24개 보호 파일 불변을 확인했다.

운영에서는 배포 파일 해시·공개 홈·접근 보호를 검증했다. 관리자 곡정보의 브라우저 검증은 실제 소스와 분리된 테스트 데이터로 수행했으며, 운영 관리자 세션에서 실제 곡을 수정하지 않았다. 상세 증거는 [song-info-followup.json](workspace-20261027/song-info-followup.json)에 보관한다.

## 초기 반영 내용

| 요청 | 적용 |
| --- | --- |
| 미분류 표시 | 곡이 없으면 숨김. 곡이 있으면 별도 펼침 버튼 없이 전부 표시. 음원·영상 공통 탐색에 적용. |
| 곡정보 4단 분류 | 카테고리 → 세부 장르 → 곡 묶음 → 세부 목록. 음원·영상·통합 라이브러리·편집 화면이 저장된 장르, ACT/EP, 사용자 묶음 관계를 공통으로 사용. |
| 검색곡 관리자 수정·삭제 | 검색 결과에서 같은 곡 원본을 바로 수정. 삭제는 휴지통 이동이며 복원 가능. 삭제된 곡은 일반 목록·영상 연결·JUKEBOX 선택에서 제외. 원본 음원·가사·변경 이력은 보존. |
| 최고관리자 사용성 | 콘텐츠 관리 / 제작 작업실 / 운영 설정 / 고급 점검·데이터 복구의 네 그룹으로 재분류. 각 기능에 사용 순서 안내. 공통 작업실로 돌아가기, 곡 검색, AI 제작 작업별 패널, 설정 바로가기 연결. |

## 미반영 원인과 수정

이전 [배포 실행](https://github.com/rucyjeon79/noa-studio/actions/runs/40416426184)은 PHP·MySQL·브라우저 검사를 통과했지만, 같은 저장소의 부산지부 변경으로 main이 이동해 `obsolete_candidate_no_operating_files_changed`에서 중단됐다. 서버 적용 전 실패였다.

[PR #223](https://github.com/rucyjeon79/noa-studio/pull/223)에서 작업실 배포에 한하여, 검증 후보가 최신 main의 조상이고 후속 변경이 부산지부 전용 스크립트·워크플로·문서뿐이면 진행하도록 수정했다. NOA 소스·공통 의존성·검사·배포 규칙 변경, 역행 또는 분기된 이력은 계속 차단한다. 다른 배포 진입점은 기존 exact-commit 규칙을 유지한다. 적용 직전 최신 상태도 다시 검사한다.

## 검증

- [작업실 배포](https://github.com/rucyjeon79/noa-studio/actions/runs/40419127337): candidate와 production 모두 성공.
- 실제 서버의 **27개 파일 적용·SHA-256 대조**, 보호 대상 **24개 파일 불변**.
- 원본 해시·임시 파일 검증·원자적 교체·충돌 보호·실패 시 소유 변경만 복구하는 절차 유지.
- 운영 DB 쓰기 0, 회원 변경 0, 포인트 차감 0.
- 실제 Git 이력 기반 최신성 검사 7건, 기존 분류·재생·플레이리스트 검사 34건 통과.
- 분리된 MySQL에서 수정 저장, 삭제, 복원, 동시 수정 충돌, 재요청 중복 방지, 비공개 자료 차단, 원본 스냅샷 보존 검증.
- 320/390/1280 너비와 다크·아이보리 테마: 검색·4단 분류·편집·작업실 가로 넘침 없음.
- Chromium·WebKit 계정 탐색 조합 32건 및 음원·영상 계층 4건 통과.
- [기존 기능 회귀검사](https://github.com/rucyjeon79/noa-studio/actions/runs/40419127307) 성공: 엔진·SQL·권한, 분리 환경 MP3 재생·유효 재생 집계, 실제 공개·보호 경로.
- 운영 홈 브라우저 표시·가로 넘침·스크립트 오류 검사 통과. 라이브러리·수정/삭제 API·음원·YouTube·카탈로그의 비회원 접근 차단 확인.

수정·삭제·복원 브라우저 검사는 분리된 테스트 DB에서 수행했으며, 운영 관리자 세션으로 실제 사용자 곡을 변경하지 않았다. 운영 검증은 적용 파일 해시, 공개 홈, 접근 보호를 확인했다. 실물 휴대전화 검증과 구분한다.

## 사용 경로

- [최고관리자 작업실](https://noastudio.ai.kr/noa-library.php)
- [통합 라이브러리](https://noastudio.ai.kr/noa-catalog.php)
- [곡 휴지통](https://noastudio.ai.kr/noa-catalog.php?view=trash)

## 실제 변경된 서버 파일

- `noa-bridge/sound-core.php`
- `noa-bridge/library-records.php`
- `noa-bridge/record-trash.php`
- `noa-workspace.php`
- `noa-category-order-admin.php`
- `noa-app/jukebox/core.php`
- `noa-bridge/catalog.php`
- `noa-bridge/index.php`
- `noa-bridge/youtube-store.php`
- `noa-record-action.php`
- `noa-catalog.js`
- `noa-workspace.js`
- `noa-browse.js`
- `noa-browse-edit.js`
- `noa-ui.css`
- `noa-inline-edit.php`
- `noa-catalog.php`
- `noa-editor.php`
- `noa-library.php`
- `noa-ai-lab.php`
- `noa-ai-lab.js`
- `noa-my.php`
- `noa-sitemap.php`
- `noa-music.php`
- `noa-world.php`
- `noa-youtube.php`
- `extend/noa.design.php`

상세 해시·검사 결과·배포 산출물 정보는 [evidence.json](workspace-20261027/evidence.json)에 보관한다. 이 완료는 이번 네 항목에 한정하며 기존 다른 개발 범위와 운영 N80 저널을 전체 완료로 바꾸지 않는다. 이번 요청 범위에 남은 배포 오류는 없다.

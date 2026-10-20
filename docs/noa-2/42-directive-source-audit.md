# 2026-10-21 지시서 재개 대조표

기준 지시서: [첨부 원문](41-execution-directive-20261021.txt). 재개 기준 커밋 `a5e1ff234c560f5d075b8d08e5bb5c2f9d73b192`. 기존 37번 보고서 이후 작업을 이어간다. 이 문서는 전 기능 완료 보고가 아니다.

## 실제 원본 코드에서 확인한 Suno 경로

- `src/routes/api/suno-audio.ts` → `src/lib/suno-audio-server.ts`의 `sunoAudioResponse`.
- 입력 `u`에서 `/song/<UUID>` 또는 공유 주소의 리디렉션·canonical을 읽고 ID를 확인한다. `meta=1`은 제목·이미지를 반환한다. `studio-chrome.tsx`의 `fillSunoTitles` 및 `MasteredDownload`가 이를 사용한다.
- `resolveSuno` → `songMedia`에서 페이지 메타데이터·ID 인접 데이터·oEmbed를 읽는다. 원본 구현에는 추측한 CDN 주소와 다른 곡 이미지가 섞일 수 있는 loose fallback도 있다. 이를 실제 원본 파일 확보로 계산하지 않는다.
- 원본 모듈에는 일반 공개 파일 검사 외에 암호화 M4A 권한 키·복호화 분기도 있다. 이 분기를 새 운영 경로에 연결하지 않았다. 허용된 일반 원본 파일과 확인된 권한 경로가 필요하다.
- `src/lib/music-player.ts`의 `masteredWavUrl` → `src/lib/loudness.ts`의 `prepareMastered`로 브라우저 처리한다. 원본 데이터 저장은 `src/lib/level-file.ts`의 곡 ID 매핑·빈 `audioAnalysis`/`audioLevel` 기록 경로다.
- `MASTER_INTENSITY=50`의 원본 DSP를 찾았다. `masterBuffer`: 저역 shelf 120Hz/+1.5dB, 고역 shelf 8kHz/+1.2dB, compressor threshold -18dB/knee 8dB/ratio 2.5/attack 12ms/release 140ms, tanh drive 1.5/wet .175/2배 oversampling. 이후 LUFS 보정·피크 보정·브라우저 WAV blob을 만든다.
- 이 코드의 peak 측정은 샘플 최대값 경로이므로 True Peak 준수 판정과 구분해야 한다. 현 서버 `lab/mastering.mjs`는 이 EQ/압축/포화 조합과 동등한 구현이 아니다. `-14 LUFS/-1dBTP` 테스트가 원본 Intensity50 승계를 증명하지 않는다.
- 원본 브라우저 WAV blob과 `/tmp/suno-cache`는 영구 서버 MP3 캐시가 아니다. 원본 구현을 그대로 연결해도 지시서의 MP3 영구 캐시·WAV 임시 생성 요구가 자동 충족되지 않는다.

## 요구사항별 재개 상태

| 지시 | 실제 구현·원본 위치 | 이번 처리와 남은 범위 |
|---|---|---|
| 00 재개/보존 | GitHub main, 기존 37번 검증 보고, `noa_sftp_deploy.py` | 기존 정식 서버 배포 경로 유지. 코어 보호·SHA 대조·SQL 쓰기 없는 프로그램 변경 |
| 01 기능 감사 | `src/components/studio`, `src/lib`, `deploy`, `bridge` | 원본 Suno·DSP 호출 관계 추가 확인. 숨은 기능까지 완전한 1:1 전체 감사는 미완료 |
| 02 자산 | `23-asset-inventory.json`, `public` | 기존 미디어를 재사용. 이번 신규 원본 이전 0. 기존 123개는 이전 보고 수치이며 재이전으로 합산하지 않음 |
| 03 메인/심볼 | `noa-hero.js`, `noa2.php`, `noa-brand.js` | 원본 클립 반복을 켬. 무음·인라인·정지 이미지·동작 줄이기·회전 보존. 기존 심볼 유지 |
| 04 반응형 | `noa-ui.css`, `noa-world.css`, `noa-responsive.mjs` | 공통 디자인을 사용한 독립 세계관. 검사 너비에 1024px 추가. 최종 실행 결과 별도 기록 |
| 05 탐색/명칭 | `noa-ui.js`, `noa2.php` | 세계관 메뉴를 독립 주소로 전환. 홈 사연곡·커버곡 정식 명칭 수정. MY 이동 유지 |
| 06 홈 순서/순위 | `home-core.php`, `noa-home.js` | 기존 정확한 9섹션·조회수 집계 유지. 신규 전체 채널 동기화는 이번에 실행하지 않음 |
| 07 장르/ACT | `noa-browse.js`, SQL catalog | 기존 4대 분류와 수록 순서 유지. ORIGINAL/COLLECTION/OTHER GENRE 전체 펼침과 아코디언은 미완료 |
| 08 영상 | `noa-youtube.php`, `noa-youtube.js` | 공식 플레이어·공개 썸네일 유지. 세계관 MV는 실제 ACT 수록 관계와 곡 ID로 연결 |
| 09 Suno/JUKEBOX | 원본 Node·`music-player.ts`, 현 `noa-music.php` | 실제 모듈·입출력 경로 확인. 원곡/1:1커버 확보와 자체 원곡 재생은 미완료. 공유 주소를 음원으로 표시하지 않음 |
| 10 보정/다운로드 | 원본 `loudness.ts`, 현 `lab/mastering.mjs` | Intensity50의 실제 정의 확인. 엔진 동등성·운영 실곡·MP3 캐시·WAV 다운로드·원형 계기판 미완료 |
| 11 미등록곡 | 기존 `catalog-recovery.php`, 21번 보고 | 기존 복구 유지. 이번 곡 생성/병합 0. 601→605 수치는 이전 운영 검증 결과이며 이번 신규 전수 대조 수치가 아님 |
| 12 가사/편집 | `sound-core.php`, `noa-music.php`, `catalog.php`, `noa-catalog.php` | 청취자용 표시만 파생. 알려진 제작 태그 제거·실제 괄호 가사 보존·원본 저장/편집 유지. 파생 가사 영구 DB 저장은 하지 않음. 카드별 편집 아이콘은 미완료 |
| 13 독립 세계관 | `noa-world.php`, `world-core.php`, `noa-world.css` | 독립 인덱스·ACT 주소·NOA/NOEL 공식 이미지·실제 EP 수록 관계·MV 설명·커뮤니티 검색 연결. 공식 소설 원문 미확보. 곡 소개·가사를 소설로 대체하지 않음 |
| 14 커뮤니티/테마 | 기존 `deploy/theme/noa_studio` | 기존 스킨·권한 보존. 실시간 알림·답글/대댓글 통합·회원 쓰기 회귀 미완료 |
| 15 관리자 | 기존 catalog/recovery/editor | 기존 권한·도구 유지. 요청한 전체 재설계·필드별 병합/되돌리기 UI 미완료 |
| 16 AI/Android | `lab`, `android`, 기존 35/38번 보고 | 이번 유료 생성/업로드/APK 변경/실기기 검사 0. 기존 검증과 실곡·실기기 성공을 구분 |
| 17 정리/독립 | 저장소/회귀 검사 | 원본 삭제·참조 일괄 제거 없음. 전 자산 독립/백업 복원/실곡 검증 미완료 |
| 18~19 증명 | 정식 배포 워크플로·후속 검증 기록 | 검증한 파일/URL/시나리오만 성공으로 기록. Grok 유지 |

세계관은 SQL의 `public_verified`와 소유권을 확인한 공개 ACT만 표시한다. 공용 음악 API의 ACT52개와 세계관 공개 목록 개수는 별개다. 공개 확인되지 않은 ACT를 노출시키기 위해 공개 플래그를 변경하지 않았다. 소설 전용 필드가 없는 ACT에는 원문 연결 대기를 표시하며, 이를 소설 본문 승계 완료로 보고하지 않는다. 공식 MV는 다른 채널·비공개·임베드 불가·미확정 분류를 제외한다. 제목으로 자동 연결하지 않는다.

외부 Grok 원본 URL의 직접 HTTP 조회는403이었다. 저장소에 승계된 소스를 조사한 사실과 원격 원본 앱의 모든 동작을 검증한 사실을 구분한다.

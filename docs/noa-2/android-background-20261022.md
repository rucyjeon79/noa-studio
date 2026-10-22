# NOA STUDIO 2.0 — Android·백그라운드 재생 결과

기준일: 2026-10-22. 이 Work의 담당 범위는 사용자가 지정한 **Android·백그라운드 재생**이다. 전체 웹 개편의 완료 보고와 구분한다.

## 이어받은 상태와 보호 범위

- 마지막 정상 main 커밋 `f37b46266b2a585d255cc9a3e719cc262a4811f9`에서 별도 `work/android-background-20261022` 브랜치로 이어받았다.
- 다른 Work의 체크아웃·미커밋 변경을 읽기 전용으로 확인했고 수정·초기화·중단하지 않았다.
- 시작 시 운영 공개 카탈로그 544개 항목 중 실제 MP3 연결 20곡을 확인했다. Android의 기존 URL 검사에는 새 `jukebox/stream.php?key=…&type=audio` 주소가 빠져 있어 이를 보완했다.
- 기존 운영 APK는 build 13이다. SHA-256: `2d6a5131898eeaeb8eb98a58cc799cf9fb34551511d19bbd7ce1abfe6e2a2fd2`.
- SQL 마이그레이션·수정 **0건**. 기존 회원·음악·MP3·이미지·회원 재생목록·설정과 서버 FIFO/업로드 작업을 변경하지 않았다. 서버 검증은 공개 조회와 APK 무결성 확인을 사용했다.

## 구현 결과

| 영역 | Android 반영 결과 |
| --- | --- |
| HOME·내비게이션 | 운영 HOME을 앱 내부에서 열고 공통 하단 메뉴와 홈 아이콘을 유지한다. 페이지 로딩 완료 시 메뉴를 재생성하지 않고 활성 상태만 바꾼다. |
| YOUTUBE·NOA WORLD | 기존 운영 화면을 WebView로 열고, 실제 영상 재생 요청 메시지를 받으면 네이티브 음악을 일시정지한다. 메뉴에 들어가는 것만으로 음악을 중지하지 않는다. |
| MUSIC | 검증된 MP3를 먼저 표시한다. MP3 미등록 곡에는 정상 재생 아이콘을 노출하지 않는다. 한 곡 선택 시 재생 가능한 MUSIC 곡들을 목록 순서대로 큐에 넣는다. 검색·카테고리 선택 UI는 제거했다. |
| MY PLAYLIST | 기존 회원 API·WebView 로그인 쿠키·CSRF·revision 계약을 재사용해 조회·담기·재생한다. 비회원은 기기 내 기본 목록을 사용하며 중복 담기를 막고 저장 실패를 알린다. 기존 웹 계정 관리로 이동할 수 있다. |
| JUKEBOX | 앱 공통 셸 안에서 정확히 2줄을 유지한다. 첫 줄은 이미지·제목·이전/재생/다음/추가 조작, 둘째 줄은 현재 시간·탐색바·총길이다. 좁은 화면의 이전 곡은 추가 메뉴로 이동한다. |
| 재생 방식 | 순차·셔플·한 곡 반복 상태, 큐 열기와 곡 선택, 닫기를 제공한다. 셔플은 ExoPlayer의 섞인 순서를 사용한다. |
| 긴 제목·색상 | 실제 표시 폭을 넘는 제목만 네이티브 marquee로 흐르게 하고 동작 줄이기 설정에서는 말줄임한다. 전체 제목은 접근성 설명으로 제공한다. 카드색 추출은 비동기·캐시 방식이며 진행바 대비를 보정하고 실패 시 골드를 사용한다. |
| 재생 지속·복원 | 단일 MediaSessionService/ExoPlayer가 화면과 별도로 재생한다. 이벤트 및 3초 간격으로 큐·곡·위치·모드를 저장한다. 프로세스 재접속은 저장된 큐를 일시정지 상태로 복원한다. |
| 닫기 | 재생을 중지하고 실시간 큐와 플레이어를 숨기되 저장된 큐·위치와 개인 목록은 보존한다. MUSIC/MY에서 명시적으로 재생하면 다시 표시한다. |
| Android 제어 | 미디어 알림·MediaSession·오디오 포커스·화면 꺼짐용 wake 처리·이어폰 분리 대응을 Media3와 연결했다. 알림은 기존 Activity를 다시 연다. |
| 업로드 충돌 | 해당 기기의 기존 업로드 heartbeat만 재생 제한으로 연결한다. 업로드 진행 영역에서 기존 상세 창을 열 수 있다. 네이티브 메뉴 이동은 업로드 WebView를 보존하고, 업로드 중 WebView 새로 이동을 막는다. 방향 전환도 WebView를 다시 만들지 않는다. |

네이티브 백그라운드 재생 대상은 검증된 MP3다. YouTube는 공식 임베드로 시청하고 앱이 백그라운드로 전환되면 영상을 정지한다.

원본 가사·제목·이미지를 새로 생성하거나 SQL 원문을 수정하지 않았다. 네이티브/웹 연결 메시지는 HTTPS 운영 출처의 최상위 프레임으로 한정했고, 미디어 URL도 기존 운영 경로·쿼리 계약으로 검증한다. 네이티브에서 검증한 카탈로그 항목만 가로채며, 카탈로그 밖 관리자 미리듣기는 원래 웹 재생 경로를 유지한다. 숨겨진 WebView는 미디어를 시작하거나 현재 음악 포커스를 가져갈 수 없다. MUSIC·MY 재진입 시 오래된 카탈로그를 재조회한다. 이 연결 계약의 Node 회귀 검사 4개도 추가했다.

## 수정 파일

- `.github/workflows/noa-android.yml`
- `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/kr/ai/noastudio/MainActivity.java`
- `android/app/src/main/java/kr/ai/noastudio/PlaybackService.java`
- 같은 패키지의 신규 `JukeboxView.java`, `PlaybackStateStore.java`, `NoaMediaPolicy.java`, `NativePlaylistRepository.java`
- `android/app/src/main/assets/noa-native-bridge.js`
- `android/app/src/main/res/values/noa_theme.xml`, `android/app/src/main/res/drawable/noa_home.xml`
- `androidTest`의 `CatalogTest.java`, `NativePlaybackTest.java`, `MediaPolicyTest.java`, `PlaybackRestoreTest.java`
- `scripts/noa_android_sign_candidate.py`, `tests/android/native_bridge_test.mjs`

## 검증

[PR #39](https://github.com/rucyjeon79/noa-studio/pull/39)는 최신 main에 통합했다. 최초 통합 커밋은 `aef2b183ed99027a867f19ac9d0de7293f91aa53`, 최종 Android 코드 커밋은 `57e26f4c214aa99099594383a7ec78d2a36dc966`다. Media3의 NETWORK wake 모드는 재생·버퍼링 중 CPU·Wi-Fi를 유지하고 정지·일시정지 시 해제한다.

[최종 main 검사 run 34](https://github.com/rucyjeon79/noa-studio/actions/runs/39704421282)의 **APK·검증 APK 생성, lint, 연결 계약 검사 4개, 기능 검사 3개, 별도 프로세스 재시작 검사 1개가 모두 통과했다.** Android API 35 에뮬레이터 결과이며 물리 기기 검사와 구분한다. 수집한 `AndroidRuntime:E`·`NoaApi:E` 로그는 비어 있다.

[같은 커밋의 기존 기능 회귀 검사](https://github.com/rucyjeon79/noa-studio/actions/runs/39704421361)도 성공했다. 격리된 fixture로 기존 엔진·접근 제어·SQL 무결성을 검사했고, 운영 공개/보호 경로를 데이터 수정 없이 확인했다.

| 검사 | 최종 관측 결과 |
| --- | --- |
| 실제 운영 MP3 | `single:kpop-original:01`. 합성 PCM 대신 실제 공개 MP3를 엔진에서 재생했다. |
| MUSIC→MY | 실제 재생 버튼, 비회원 2곡 담기·중복 방지, 네이티브 MY 목록 재생 통과 |
| 백그라운드·화면 꺼짐 | 전면 2006ms, 홈으로 이동 후 46162ms, 화면 꺼짐 후 49223ms로 재생 위치 진행 |
| 내부 메뉴 이동·회전 | HOME·YOUTUBE·MY·MUSIC와 세로/가로 방향 전환 중 재생 유지 |
| DARK·IVORY | 재생 중 테마 전환 후 재생 유지, 진행바 대비 3:1 이상 검사 통과 |
| 2줄·하단 겹침 | 320·390·430·768·1024·1280·1920 **dp 네이티브 레이아웃**의 자식 수·경계 검사, 실제 세로/가로 화면 확인 |
| 포커스 | 숨겨진 웹 요청은 무시, 표시 중인 웹의 영상 요청은 음악 일시정지, 일시적 오디오 포커스 상실 처리 통과 |
| 미디어 조작 | 미디어 알림·세션 토큰, 미디어 키의 일시정지/재생 통과 |
| 업로드 기기 제한 | 로컬 제한 중 재생 거절, 해제 후 명시적 재생 통과 |
| 강제 종료·재접속 | 비회원 목록과 2곡 큐·셔플·7000ms 위치를 자동재생 없이 복원 |
| 닫기 | 플레이어 숨김, 2곡 큐·7000ms 저장 위치 보존 |
| 연결 계약 4개 | 공개곡의 네이티브 단일 재생, 카탈로그 밖 관리자 웹 미리듣기 경로, 갱신된 곡 연결, 숨겨진 미디어 차단 |

최종 DARK·IVORY 재생 화면과 가로 화면 스크린샷을 직접 확인했다. 표의 연결 계약 검사는 JavaScript 단위 검사이며 실제 관리자 계정 미리듣기 종단 검사와 구분한다. 원시 검증값은 `android-background-proof-20261022.json`에 기록했다.

[검증 APK build 34](https://github.com/rucyjeon79/noa-studio/actions/runs/39704421282/artifacts/12393639776)는 임시 서명본이다. 기존 build 13과 서명이 달라 **기존 설치의 정식 업데이트용이 아니다.** 파일 크기는 5,045,429 bytes, SHA-256은 `dc8638297dbfca7ca84de2ad34de4f072795be25b122298f0cf5c42fc972c880`다. [스크린샷·검증 자료](https://github.com/rucyjeon79/noa-studio/actions/runs/39704421282/artifacts/12394755465)도 같은 실행에 있다.

## 닷홈 운영 반영 결과

**정식 APK 교체는 미완료다.** run 34의 publish 작업은 원본 keystore가 암호화 secrets에 등록되지 않아 서명 단계에서 실패했다. SFTP 업로드는 실행되지 않았다. APK 검사 성공과 배포 실패를 분리해서 보고한다.

배포 시도 후 실제 운영 `noa-android-release.json`과 해당 APK를 다시 내려받아 확인했다. 여전히 `noa-studio-android-build-13.apk`, 4,579,329 bytes이며 SHA-256 `2d6a5131898eeaeb8eb98a58cc799cf9fb34551511d19bbd7ce1abfe6e2a2fd2`로 기존 값과 일치한다. 기존 사용자 설치·데이터를 위해 호환되지 않는 후보 APK로 다운로드를 바꾸지 않았다. 새 Android 기능은 main의 검증 APK에 구현됐고, 현재 운영 build 13에 반영됐다고 표시하지 않는다.

## 운영 APK 배포 조건

기존 운영 APK의 인증서 SHA-256은 `b2265d6925fc4eeb9e014ba3a985c040e92d26c8e20ead5e6d4e505bafda81f2`다. 새 임시 빌드의 인증서가 다름을 실제 파일로 확인했다. 인증서가 다른 APK로 기존 설치를 갱신할 수 없으므로 기존 다운로드를 보존한다.

배포 작업은 **검증한 APK → 원본 설치 서명키로 서명 → 기존 운영 APK와 인증서 대조 → 기존 pinned-SFTP 배포 → 운영 다운로드 해시 확인** 순서다. 일반 Android push는 검사만 실행한다. 명시적 main `[android-publish]` 커밋 또는 `workflow_dispatch publish=true`만 배포를 요청한다. 기존 운영 배포 concurrency와 취소 금지 규칙을 유지한다.

원본 keystore는 암호화된 GitHub secrets로만 받도록 준비했다: `NOA_ANDROID_KEYSTORE_BASE64`, `NOA_ANDROID_KEY_ALIAS`, `NOA_ANDROID_KEYSTORE_PASSWORD`, `NOA_ANDROID_KEY_PASSWORD`. 새 대체 서명키를 만들거나 원본 키·비밀번호를 저장소·로그에 노출하지 않는다. 필수 키가 없거나 인증서가 다르면 서버 파일 교체 전에 실패한다.

## 남은 항목과 정확한 범위

- 실제 Android 휴대폰의 장시간 절전·전화 수신·페어링된 블루투스/이어폰 환경이 없어 **물리 기기 검증은 미완료**다. 에뮬레이터의 포커스·미디어 키 성공을 실기기 성공으로 계산하지 않는다.
- 폭 검사는 dp 기준의 네이티브 측정이다. 운영 웹의 CSS px별 스마트폰·태블릿·PC 검증을 대신하지 않는다.
- 회원 API 어댑터는 구현했으나 실제 회원 로그인·서로 다른 기기 간 MySQL 동기화 종단 검증은 미완료다. 네이티브 목록의 순서 변경·이름 변경·여러 목록 생성·삭제 UI는 이 변경에 포함되지 않는다. 기존 웹 관리와 해당 Work의 후속 구현·검증이 필요하다.
- YouTube 실제 영상 시청·설명/가사 연결·자동 동기화, HOME의 전체 섹션, NOA WORLD·AI LAB 웹 개편은 담당 웹 Work의 범위다. 이 Work는 기존 화면과 네이티브 오디오의 연결을 구현했다.
- 웹과 네이티브의 테마 설정을 자동 동기화하는 기능은 이 변경에 포함하지 않았다. 각 영역의 DARK·IVORY와 네이티브 플레이어 대비를 검증했다.
- 원본 설치 서명키가 없으면 build 13의 호환 업데이트를 정식 배포할 수 없다. APK 생성/Actions 성공만으로 운영 배포 완료 처리하지 않는다.

# 첫 화면 홈 진입 및 Apple 설치 안내 — 운영 반영

운영 소스는 `519509528ccdab3fc4cd49434325ee702f44c914`이다. 첫 기능 배포 `10ccd6551891cbc124ab0217b19b1c1613346143` 후 모바일 회원 상단 바를 보완했다.

- [최종 기능 검증·배포](https://github.com/rucyjeon79/noa-studio/actions/runs/40340536673)
- [초기 기능 검증·배포](https://github.com/rucyjeon79/noa-studio/actions/runs/40339661796)

## 해결한 원인

기존 진입 보정은 `display-mode: standalone` 및 세션 플래그에 의존해 일반 브라우저나 오래 복원된 세션을 놓쳤다. 기존 음원 주소(`/noa-music.php`) 또는 그 주소를 대상으로 하는 로그인 페이지에 직접 진입하면 홈으로 이동하도록 수정했다. 내부 메뉴 클릭, 음원·장르·게시판 앵커, 다른 로그인 목적지 및 소셜 인증 매개변수는 보존한다. 저장소 접근이 막혀도 직접 진입 보정이 작동하며 권한 안내 화면에도 보정 스크립트를 연결했다.

기존 설치 바로가기는 Android APK만 내려받는 주소였고 iOS 안내가 없었다. 공개 `/noa-install.php`와 상단·사이드바·MY·사이트맵의 공통 앱 설치 바로가기를 추가했다. iPhone/iPad는 Safari 공유 메뉴의 홈 화면에 추가, Mac은 Safari Dock에 추가, Android와 PC는 브라우저 설치를 안내한다. 홈에서 설치 안내를 열면 URL을 깨끗한 `/`로 정리한다. Apple에서 예전 APK 바로가기를 열어도 공통 설치 안내로 보낸다.

manifest의 기존 설치 identity는 유지하고 시작 주소 `/`를 보존했다. 브랜드 스크립트가 최신 manifest 링크를 과거 캐시 주소로 덮어쓰는 문제를 제거했다. 320px 회원 화면에서 상단 바로가기와 계정 정보는 두 줄, 총 97px로 정렬되며 로그아웃을 유지한다.

## 검증과 범위

- 조건별 시작 경로 6개 단위 검사 통과.
- 격리 PHP의 실제 권한 분기: 비회원·일반회원·VIP를 포함한 진입 및 직접 링크 16건 통과.
- Chromium/WebKit × iPhone·iPad·Android·Mac × 두 테마: 16개 화면의 설치 안내·깨끗한 홈 주소·닫기·가로 넘침 없음 확인.
- 320px 로그인 상태의 두 테마에서 상단 높이 97px, 로그아웃 노출 확인.
- 설치 요청 취소와 이미 앱으로 실행 중인 상태 처리 확인.
- 실제 운영 익명 진입 8건 및 기기·테마별 화면 8건 통과. iPhone 계열 APK 다운로드는 설치 안내로 리디렉션된다.
- 보호 대상 20개 파일 보존. DB·회원·포인트·음원·기존 Android APK 변경 없음.
- iOS App Store 앱 배포 또는 물리 iPhone에서 OS 설치 완료를 검증한 작업은 아니다. 이번 제공 방식은 홈 화면 웹앱이며 Safari 설치 절차를 연결했다.

## 증빙

- [격리 브라우저 결과](install-home-20261027/candidate-report.json)
- [운영 브라우저 결과](install-home-20261027/live-report.json)
- [배포·원본 보존 해시](install-home-20261027/deployment.json)
- [iPhone 설치 화면](install-home-20261027/iphone-install-live.png)
- [홈에서 열린 Apple 설치 안내](install-home-20261027/home-apple-install-live.jpg)

Apple 안내: https://support.apple.com/ko-kr/guide/iphone/iphea86e5236/ios 및 https://support.apple.com/ko-kr/104996

## 기존 검사 정리

사이트맵의 누락 파일 검사는 새 설치 안내 경로를 기준으로 유지했다. 홈 원본 보호 검사의 기준은 이미 승인·배포된 게시판별 제목 추가 커밋 `e92536b4ec3f20f6cb32e1ece0b1a6cd9584505e`로 고정했다. 기존 홈의 음악·EP·사연곡·커버·플레이리스트 영역 보호는 그대로다.

네이티브 게시판 화면 검사의 HTTP 가로채기가 로그인 리디렉션을 먼저 따라가 잘못된 URL에 로그인 HTML을 표시하던 문제를 수정했다. 브라우저가 실제 302를 따라가게 하고, 비회원에게는 검색 폼 대신 로그인 폼을 검증한다. 권한을 우회하거나 게시판을 공개하지 않았다.

- 네이티브 화면 검사: https://github.com/rucyjeon79/noa-studio/actions/runs/40390297301
- 기존 기능·실제 음원 처리·운영 접근 검사: https://github.com/rucyjeon79/noa-studio/actions/runs/40390297392

두 최종 회귀 검사 모두 성공했다. 운영 변경을 하지 않는 후속 배포 단계는 의도대로 생략됐다. [최종 확인 기록](install-home-20261027/final-verification.json)

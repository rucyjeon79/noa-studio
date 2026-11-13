# NOA STUDIO — Google Play 등록 준비 (2026-11-14)

> **출시 차단 상태**: API 36 대응 코드는 검토 브랜치에서만 준비되었습니다. Play Console 등록·업로드, 실기기 테스트, 결제 정책 승인을 완료했다고 표시하지 마세요. 기존 APK와 회원·결제·음원 데이터는 변경하지 않습니다.

## 현재 소스 확인

- 고정 앱 ID: `kr.ai.noastudio` (변경 금지)
- Google Play 신규 업로드는 서명된 **AAB** 사용; APK는 직접 설치·별도 테스트용
- 2026-08-31부터 신규 앱·업데이트: **targetSdk 36 이상**
- Android Gradle Plugin 8.10.1은 API 36 지원. 검토 브랜치에서 `compileSdk 36` / `targetSdk 36`을 준비
- 기존 빌드 결과가 있어도 **신규 API 36 빌드가 성공했다고 간주하지 않음**
- `versionCode`는 기존 설치·Play 이력보다 증가하고 2,100,000,000 미만이어야 함
- 릴리스 키는 기존 영구 키를 사용하고 Play App Signing 및 업로드 키를 확인. 디버그 키 사용 금지
- 기본 브랜치에 병합하면 APK 배포 자동화가 작동할 수 있으므로 **검수 완료 전 병합 금지**

## Android 16 QA (게시 전 필수)

- API 36 에뮬레이터 + Android 16 실기기에서 실행·홈/음원/영상/커뮤니티/로그인/로그아웃 확인
- 상태바·내비게이션바 뒤 화면 가림 없는지, edge-to-edge 및 inset 확인
- 뒤로 가기 / 예측형 뒤로 가기 / WebView 내부 이동 확인
- 백그라운드 음악 / 알림 / 재생 권한 / 기기 회전 및 태블릿 배치 점검
- 정식 URL과 실제 서버 인증 상태를 사용해 통합검증. 테스트 계정·가짜 데이터와 운영 결제를 혼동 금지
- 서명된 AAB·APK의 SHA-256, 인증서와 설치/업그레이드 결과 기록

## Google Play Console에서 완료할 항목

1. 개발자 계정·사업자 인증 및 앱 `kr.ai.noastudio` 소유권 확인
2. 개인정보처리방침, 앱 내/웹 계정 삭제, 데이터 보안 양식, 광고 여부, 연령/타깃, 콘텐츠 등급 작성
3. 앱 소개·스크린샷·고해상도 아이콘·그래픽·연락처·테스트 계정 준비
4. 업로드 키/Play App Signing 확인 후 **서명된 새 AAB**를 내부 테스트 트랙에 업로드
5. 로그인·스트리밍·유료 기능·결제 정책 검증 및 테스트 결과 확인
6. 해당되는 개인 개발자 계정은 비공개 테스트 12명/14일 요건 충족 후 프로덕션 접근 신청
7. Play Console의 거절/경고 및 출시 검토를 확인한 뒤 **관리자가 직접 정식 출시**

## 디지털 결제: KCP / 토스 / Google Play

- NOA 포인트·VIP 이용권은 **디지털 상품**. Play 배포 앱은 원칙적으로 Google Play Billing 필요
- 한국에서 KCP 등 대체 결제를 선택하려면 **Play Console 대체 결제 프로그램 등록, 해당 API 연동, 거래 보고 및 필요한 수수료·이용자 안내 요건**을 충족해야 함
- 승인·보고 체계가 준비되지 않은 Google Play 앱에서 KCP/토스 결제창이나 외부 결제 링크로 유도하지 말 것
- 실물 굿즈 결제는 디지털 이용권과 별도 정책·PG 경로로 분리할 것
- KCP `T0000` 테스트 거래는 운영 결제·포인트 지급과 영구 분리. 테스트 성공은 운영 가맹점 인증/승인을 의미하지 않음
- 웹에서의 기존 토스 결제·회원·포인트·VIP 이력은 현재 동작 그대로 보존
- 새로운 결제 방식 도입 전 서버측 주문 금액 검증·승인·중복 방지·취소/환불·정산·알림의 안전 테스트 필요

## 출시에 앞선 작업 순서

API 36 빌드 → 기기/브라우저 동작 검수 → 디지털 결제 정책 경로 확정 → 심사 정보/테스트 계정 준비 → Play 내부 테스트 → 비공개 테스트(해당 시) → 정식 게시.

공식 안내:
- [Google Play 대상 API 수준](https://support.google.com/googleplay/android-developer/answer/11926878?hl=ko)
- [Google Play 결제 정책](https://support.google.com/googleplay/android-developer/answer/9858738?hl=ko)
- [한국 대체 결제](https://support.google.com/googleplay/android-developer/answer/11222040)
- [KCP 표준결제](https://developer.kcp.co.kr/guide/payment)

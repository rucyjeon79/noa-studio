# NOA STUDIO — Google Play 등록 준비 (2026-11-14)

> **2026-11-14 운영 현황**: 개발자 등록비는 운영자가 이미 납부했다고 확인함(Play Console 계정 인증·앱 생성 여부는 아직 원격 검증되지 않음). 기존 영구 인증서로 API 36 APK·AAB 후보를 서명하고 빌드·연속성 검사를 완료했지만, **Play Console 업로드·내부 테스트·심사·정식 게시는 미완료**. 기존 운영 APK와 회원·결제·음원 데이터는 변경하지 않음.

## 현재 소스 확인

- 고정 앱 ID: `kr.ai.noastudio` (변경 금지)
- Google Play 신규 업로드는 서명된 **AAB** 사용; APK는 직접 설치·별도 테스트용
- 2026-08-31부터 신규 앱·업데이트: **targetSdk 36 이상**
- Android Gradle Plugin 8.10.1은 API 36 지원. 검토 브랜치에서 `compileSdk 36` / `targetSdk 36`을 준비
- API 36 검토 빌드 검증: 2026-11-14 GitHub Actions `43550601521` 성공, APK와 AAB 모두 서명/검증됨. 실제 기기/Play 검증과는 구분
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

## 기존 영구 서명 APK·AAB 검토 후보 (빌드 완료, Play 게시 아님)

- 빌드: `https://github.com/rucyjeon79/noa-studio/actions/runs/43550601521`
- 앱 ID: `kr.ai.noastudio`; 검토 후보 versionCode `1794626080` (호스트 운영 APK `1794222381`보다 높음)
- 서명 인증서 SHA-256: `f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b`, 기존 운영 APK와 일치
- 서명 APK: `noa-studio-release.apk` 6,024,316 bytes, SHA-256 `da55a4ab98877164294b783edca2c53767b57cddb987dddf923958b4b51eceb1`
- 서명 AAB: `noa-studio-release.aab` 5,807,835 bytes, SHA-256 `8cfb519ab55f13c167cfa15d584286da3d6791353f70435fb936ecbbb7f3b38b`
- 아티팩트 이름: `NOA-API36-SIGNED-REVIEW-ONLY` (7일 보존). 파일은 검토용이며 실제 Play Console 등록 이력이 아님
- **기존 인증서와 Play Console의 업로드 키/앱 서명키 관계는 Play Console에서 직접 대조해야 함.** 서명 동일성만으로 Play 앱 소유권이나 기존 Play 업로드 이력을 추정하지 말 것

## Play Console 앱 생성·스토어 등록 정보 초안

검증되지 않은 필드를 채워 넣거나 앱을 중복 생성하지 말 것. 기존 앱 패키지 `kr.ai.noastudio`가 등록되어 있는지 먼저 확인.

| 입력 항목 | 값 또는 확인 지침 |
|---|---|
| Google Play 개발자 등록비 | **운영자가 납부 완료로 통보함**. 재결제하지 않음. 계정 검증/등록 상태는 Play Console에서 확인 |
| 앱 이름 | **NOA STUDIO** |
| 앱 유형 | 앱 (게임 아님) |
| 기본 언어 | 한국어 (ko-KR) 권장, Console 실제 설정 대조 |
| 앱 가격 | 무료 다운로드 + 디지털 상품의 인앱 결제(제안). Console 결정 확인 |
| 패키지명 | `kr.ai.noastudio` 고정 |
| 카테고리 | **음악/오디오** 제안; 실제 앱 기능과 Console 분류 확인 |
| 개인정보처리방침 | 기존 사이트 소스에 `https://noastudio.ai.kr/noa-privacy.php` 존재. **공개 접속·내용 일치 확인 전 미제출** |
| 계정 삭제 웹 주소 | **미확정**. 개인정보처리방침의 로그인 필요 1:1 문의만으로 외부 계정 삭제 경로 충족을 주장하지 않음 |
| 이용자 지원 이메일 | **미확정**. 실제 운영 중인 응대 주소만 입력, 임의 이메일 금지 |
| 앱 액세스 | 회원 등급·VIP·AI 기능이 있으므로 심사용 접근 경로/테스트 계정을 Console에 비공개로 제공(저장소에 비밀번호 보관 금지) |
| 앱 콘텐츠 | 광고·타깃 연령·데이터 보안·콘텐츠 등급·AI/UGC 정책 항목은 실제 기능 및 처리 내용을 검증 후 응답 |
| 개발자 계정 | 납부 완료 사실과 계정 본인확인·조직/개인 구분 및 Play 앱 생성 완료는 별도 상태 |

### 한국어 스토어 설명 문안 (확정 전 검토용)

**앱 이름:** NOA STUDIO

**간단한 설명 (80자 이하):** 노아의 음악과 뮤직비디오, 재생목록과 별무리 커뮤니티를 한곳에서

**자세한 설명:**

NOA STUDIO는 AI Artist NOA의 음악과 이야기를 만나고 즐기는 음악 공간입니다.

- 다양한 장르의 음악과 오리지널 작품 감상
- 앨범과 재생목록으로 이어 듣는 음악 경험
- 뮤직비디오와 음악 세계관 감상
- 별무리 커뮤니티에서 나누는 음악과 이야기
- 크리에이터 채널과 참여형 음악 서비스

일부 콘텐츠와 기능은 로그인, 회원 등급, VIP 이용권 또는 포인트 이용 조건에 따라 접근이 제한될 수 있습니다. 음원 다운로드, 후원 등 유료 기능은 결제 방식과 이용 조건을 확인한 뒤 이용할 수 있습니다.

**스토어 설명은 실제 기능 및 Google Play 결제 준비 상태와 대조한 후 게시.** 현재 Play 앱의 디지털 결제·환불은 운영 검증 전이므로 정상 사용 가능한 것처럼 과장하지 않음.

### 스토어 이미지와 개인정보 검증 항목

- 스토어 아이콘: 512×512, 32비트 PNG, 1,024KB 이하. 기존 `public/icon-512.png` 파일의 실제 크기·형식과 품질 확인
- 피처 그래픽: 1024×500, JPEG 또는 투명 배경 없는 24비트 PNG. 검증된 기존 NOA 브랜드 에셋 사용; 적합한 파일이 없으면 제출 준비가 필요
- 스크린샷: 실제 기기에서 촬영한 앱 화면 최소 2장, 각 화면의 정책·개인정보 비노출 확인. 가짜 실행 화면을 제출하지 말 것
- 데이터 보안: 로그인/이메일, 회원·크리에이터 등록, AI 입력, 유료 결제 승인 정보, 재생·사용 이력, 푸시 구독 등 기존 개인정보처리방침 범위를 실제 서버 동작과 대조
- 삭제 요청: **앱 내부에서 요청 가능한 경로 + 로그인하지 않아도 안내를 읽고 삭제 요청을 시작할 수 있는 웹 리소스**를 검증. 기존 앱에서 회원탈퇴/처리상태 확인이 실제 작동하는지 확인
- 앱 검사 계정: 회원/VIP별 권한과 로그인 과정을 직접 테스트할 수 있는 별도 검사 권한을 제공하되 자격증명을 GitHub·로그·채팅에 노출하지 않음

### 계정 생성 이후 순서

1. Play Console에서 **기존 앱 존재 여부**를 먼저 확인하고, 없다면 신규 앱 생성(추가 개발자 등록비 결제 없음)
2. 앱 정보·콘텐츠 선언·이미지·개인정보·계정 삭제 웹 경로 확인
3. Play App Signing 및 업로드 키 대조 후 **서명된 AAB** 내부 테스트 업로드
4. Google Play Billing 제품/주문 서버 검증 및 KCP 정책 경로 연동; 기존 영카트·N80 Pay 정산 원장과 대조
5. 설치·로그인·재생·구매·환불·복원·크리에이터 정산 실기기 테스트
6. 개발자 계정이 **2023-11-13 이후 생성된 개인 계정**인 경우 공식 비공개 테스트 12명/연속 14일 요건을 충족하고 프로덕션 접근 신청
7. 심사 결과 확인 후 승인된 앱만 정식 출시. 출시 전에는 운영 APK·프로덕션 결제 내역을 변경하지 않음

정책 안내: [앱 생성](https://support.google.com/googleplay/android-developer/answer/9859152) · [스토어 이미지](https://support.google.com/googleplay/android-developer/answer/9866151) · [개인정보/계정 삭제](https://support.google.com/googleplay/android-developer/answer/10144311) · [개인 계정 테스트](https://support.google.com/googleplay/android-developer/answer/14151465)

## 등록 대기 후보 최종 검증 (2026-11-14)

**패키지 빌드·서명·Android 16 에뮬레이터 검수 통과 / Google Play 등록 대기 후보. Google Play 상용 결제·최종 심사 완료와 구분.**

- 검증 워크플로: https://github.com/rucyjeon79/noa-studio/actions/runs/43560185673
- 커밋: `13d1f4cf19a4bda1be623c1ff9a9f4c781afe98f`
- 앱 ID: `kr.ai.noastudio`, versionCode: `1794632996`, 기존 운영 버전: `1794222381`
- 기존 영구 서명 인증서 SHA-256 일치: `f77427fe2f2e174aeac75e6734875b9106ee13072c49cfc8146b43075764271b`
- 서명 APK: `noa-studio-release.apk`, 6,024,316 bytes, SHA-256 `611ac811a39f80baf4cab4f92f6b4ef7cc1cff567d371bbd0c4542fe9393c257`
- 서명 AAB: `noa-studio-release.aab`, 5,807,832 bytes, SHA-256 `09a11fc7d042cdc77e84bfba33737beb675d2a5532a89dfafe6e9e43e6d26d79`
- Android 16 API 36 에뮬레이터 설치, 비로그인 콜드 실행, 보안 계측 테스트 **5/5 통과**, 충돌 로그 없음
- Android API 36 컴파일·린트, 기존 기능 테스트, KCP 테스트 전용 검사, 기존 설치본과 서명·버전 연속성 확인 통과
- 서명 패키지와 테스트 리포트가 포함된 ZIP (NOA STUDIO / Backup / Android_Play_등록대기_20261114): https://drive.google.com/file/d/1vZugvMI7xzOjLEDKApnxIx0bmqE_-Ktv/view?usp=drivesdk
- 기존 운영 APK·회원·포인트·정산·결제 데이터 변경 없음. 새 앱이나 서명키를 생성하지 않았음
- 기존 N80 Hub 리비전 **299**의 앱 등록 준비 화면에 검증 상태 반영

**아직 남은 필수 확인**: Play Console 신원 인증 승인, 기존 앱 존재 여부/업로드 인증서 확인, Android 실물 기기 사용성, Google Play Billing 구매 검증·포인트·환불과 KCP 운영 연동, Google Play 계정 삭제(계정 연관 데이터 처리) 실동작 검증, 개인정보·데이터 보안 양식/스토어 이미지·문의 이메일/테스트 계정 및 Play 심사.

**현재 PR은 Draft, 미병합이며 스토어에 업로드·게시하지 않았음.** 기존 APK는 그대로이며 업로드 대상은 해당 AAB 파일임.

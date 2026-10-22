# NOA WORLD 공식 MV 복구·EP 탐색 인계 — 2026-10-22

## 실제 운영 확인
- 페이지: https://noastudio.ai.kr/noa-world.php#official-mvs
- 공식 재생목록: 📖 NOA’s Diary : EP Series M/V
- 확인된 playlist ID: `PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY`
- 공식 링크: https://www.youtube.com/playlist?list=PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY
- 채널 ID: `UCwYy9xsAqDFat6AV5UKrfgA`
- 운영 화면의 수집 항목 30, 실제 표시 MV 30, EP 매칭 30, EP 누락 0, 카탈로그 곡 ID 연결 30, 곡 연결 누락 0.
- 중복 제외 0, 비공개·삭제·사용불가 제외 0, EP 충돌 0: 모두 저장된 스냅샷 기준이다.
- ACT별 MV: ACT1 10 / ACT2 10 / ACT3 10 / ACT4 0. EP1~30 순서와 고유 영상 30개를 확인했다.
- 저장된 수집 시각: 2026-10-20T17:36:24+00:00 (한국 시각 2026-10-21 02:36:24). 이번 검증에서 새 소유자 OAuth 수집을 실행하지 않았다. 현재 채널 전체의 최신 개수라고 단정하지 않는다.
- 실제 사이트 화면: [운영 MV 목록](world-diary-live-20261022.jpg).

## 기존 복구 적용과 이번 변경 구분
기존 복구 커밋 `0190c7438b0ddb9de6bf68ecb2d5be92bb321a4f`의 공식 MV 읽기·스토리·페이지 연동은 운영에서 확인했다. 최신 다른 담당자의 스타일, 제목 정리, 인라인 플레이어 및 Android 변경을 보존했다.

이번에 실제 발견한 오류: 일반 ACT 진입(`?story=1`)에서 EP 링크를 누르면 이전·다음 EP 탐색이 나오지 않았다. PHP가 명시적 `?ep=` 진입에서만 탐색을 출력했기 때문이다.

수정: ACT 페이지 진입 시에도 탐색을 렌더링하고, EP 해시를 선택하면 이전·다음 링크와 ACT 경계를 갱신한다. EP1의 이전과 EP40의 다음은 비활성 처리한다. 수정 커밋:
- 런타임·검사: https://github.com/rucyjeon79/noa-studio/commit/02c0cd7c202c788559496adf35f2ed4f1f52b543
- CI 격리 DB 공개 상태 픽스처 수정: https://github.com/rucyjeon79/noa-studio/commit/7f8f5006c4fd3dc835472626ab3e7226f4f10ccd

**이번 EP 이동 보완은 GitHub 반영·검증 완료이며, 운영 배포는 이 인계 시점에 미확인이다.**

## 배포 담당 인계 — 런타임 2개 파일
| GitHub 소스 | 실제 서버 대상 | 새 SHA256 | 바이트 |
|---|---|---|---:|
| deploy/noa-world.js | /noa-world.js | 5d1f405096a6fb1f59b30dff472765e897a31c9eb8b988471eede643be45de2d | 3694 |
| deploy/noa-app/world-view.php | /noa-app/world-view.php | 4f481ebf9ba5d82065ac87c7a71ed526b38a39b79b92c48b294a648d18969a7a | 11283 |

비교 기준 소스의 이전 SHA256:
- JS: `9b35ef711920ec777f3cd15cfaa458340ae5778f4856da7ab60a25a5b74bde99`
- view: `858e454e4833efd7a68b085db2370f121c8b2eef26e01dfe28ee3421af20dd9d`

이전 해시는 GitHub 기준이며 이번에 SFTP로 다시 읽은 운영 해시가 아니다. 운영 파일을 먼저 비교하고 동시 수정이 있으면 보존하여 병합한다. 복구 가능한 비공개 백업 후 JS를 먼저, view를 나중에 적용한다. 스크립트 캐시 표식은 `20261022-epnav1`이다.

DB 마이그레이션, 음악 원본·회원·설정 변경, 음원 작업 대기열·워커 조작은 없다. 테스트·워크플로·격리 렌더러는 서버 배포 대상이 아니다. 예전 전체 배포 스크립트로 다른 담당자의 변경을 덮어쓰지 않는다.

배포 후 확인:
1. 일반 ACT1 진입 → EP10 선택 → 다음 EP11(ACT2) → 이전 EP10.
2. EP1 이전 / EP40 다음 비활성.
3. 운영 MV30, 곡 연결30 및 ACT10/10/10/0 유지.
4. 네트워크의 새 JS 버전과 서버 파일 해시 확인.

## 실제 검사 결과
- 최종 NOA WORLD 검사 성공: https://github.com/rucyjeon79/noa-studio/actions/runs/39703347097
- 기존 엔진 품질 검사 성공: https://github.com/rucyjeon79/noa-studio/actions/runs/39703347112
- PHP 문법, 순수 읽기 모델 검사, MySQL8 격리 DB 검사 통과.
- 격리 DB의 601곡/52ACT/520수록 관계 픽스처 검사, 정확한 재생목록 선택·페이지 항목 읽기·곡 연결·미매칭 MV 유지·EP 숫자 정렬·중복/비공개 제외·반복 읽기 불변성 통과.
- 브라우저 320/360/390/430/768/1280/1920px: 가로 넘침 없음, 실제 공개 운영 ID/제목을 사용한 MV30 표시, EP 경계 이동·공식 iframe 선택/닫기·ACT4 초안 검사 통과.
- 위 자동 브라우저 검사는 **격리된 CI PHP 렌더링**이며 정식 배포 검증으로 대체하지 않았다. 별도 프리뷰 사이트는 만들지 않았다.
- CI 화면: [390px](world-diary-ci-390-20261022.png), [1280px](world-diary-ci-1280-20261022.png).
- 최초 SQL 검사 실행 39703205046은 'public seed song required'로 실패했다. 원본 수집 픽스처가 의도적으로 미공개였는데 테스트가 공개 곡을 가정했다. 격리 DB 안에서만 명시적 공개 테스트 곡을 준비하도록 수정했고 최종 실행은 성공했다. 운영 데이터는 수정하지 않았다.

## 세계관 원문·미완료
- 저장된 공식 worldPrologue/worldChapter/worldEpilogue가 있으면 우선한다.
- 사용자 제공 ACT 소개·ACT4 에필로그는 '세계관 소개 초안 · 확정 설정 아님'으로 표시한다. 확정된 새 설정으로 승격하지 않았다.
- 전체 EP 소설 원문 확보·대조는 미완료다. 가사를 임의의 소설 원문으로 바꾸지 않았다.
- 새로운 MV는 다음 정상 수집 후 저장된 재생목록 구성원을 통해 반영되는 구조이며, 이번에 신규 MV를 생성하거나 수집을 강제하지 않았다.
- 실제 운영에서 EP1 공식 iframe `JEzRGwTJBro`가 열리고 YouTube 제목/채널 UI가 표시됨을 확인했다. 그러나 관찰 중 video readyState=0/currentTime=0이라 실제 영상·음성 스트리밍 성공은 검증하지 못했다. 차단·로그인 요구를 관찰하지 않았으므로 원인을 임의 확정하지 않는다.
- 추가 EP 이동 2개 파일의 정식 배포 및 동일 조건 재검증이 남아 있다.

# 부산지부 POINT ZONE — 영카트 기반 포인트 전용 개발

2026-11-25 사용자 확정: 현금 사용 없음. 포인트만 사용. 기존 코어 무수정.

## 설계
- 기존 홈페이지 메뉴 DB의 POINT ZONE 대메뉴 및 7개 부메뉴 유지. 독립 영카트 테마 Busan_PointZone으로 연결 예정. UXC_Flarumix는 디자인 참고용일 뿐, PHP/CSS/JS/스킨/상하단 파일을 상속하거나 참조하지 않는다. 통합 운영센터 최고 관리자만 접근.
- 영카트의 실제 설치 여부와 버전, 상품·장바구니·주문·옵션·기본설정 스키마와 포인트 원장 엔진을 먼저 조회. 누락 시 호환되는 순정 영카트 배포 패키지 검증 후 설치 방안 결정.
- 상품/주문/재고 관리는 검증된 영카트 데이터 구조를 재사용. 고객 인터페이스는 테마, 주문 정책은 독립 확장.
- POINT 단일 결제. 카드, 현금, 계좌이체, 가상계좌, PG, 휴대폰, 충전 및 현금 환급 모두 금지. 상품 가격·배송비는 P로만 표현. 상품 구매 추가 적립 없음.
- 포인트 선물 10% 규칙은 선물에만 유지. 상품 주문 취소는 원 결제 포인트만 정확히 1회 반환.
- 회원 인증/승인, CSRF 검증, 서버 가격 재계산, 재고·잔액 동시성, 거래 멱등성, 원장과 주문의 원자성 및 복구를 출시 조건으로 강제.
- 기존 일반 포인트 작업과 동시성 검증: 특히 포인트 선물·글쓰기 등 원장 접근 경로와 동일 회원의 동시 차감.
- 순정 shop 직접 URL에서도 현금 결제 우회 불가해야 함. 단순 UI 숨김으로 완료 처리하지 않음.
- 초기에는 상품과 배송 정보 없이 테스트. 실제 포인트 차감 및 현금 경로 활성화 금지. 운영 서버 상품/주문 생성 전 테스트 및 확인.

## 현재 단계
메뉴 등록 완료. 이 변경은 읽기 전용 설치 현황 조회와 포인트 전용 검증 로직 단위 테스트로 개발을 시작한다. 운영 주문 경로에 검증 로직을 연결하지 않았으며 영카트를 신규 설치하지 않았다. 이후 실제 설치 현황에 맞춰 테마 및 주문 연동 개발.

## 확정 테마 구조 (사용자 정정)
- 영카트 네이티브 theme/Busan_PointZone/shop 및 skin/shop, mobile/shop, mobile/skin/shop 구조. 독립 사이트나 자체 쇼핑몰 엔진으로 대체하지 않는다.
- UXC_Flarumix의 네이비·오션 블루, 라이트/다크, 카드 모서리 및 간격을 독립 CSS로 재현한다. 라이브 테마 파일은 수정하지 않는다.
- 순정 영카트는 G5_THEME_SHOP_PATH를 현재 활성 테마에서 결정하므로, 설치 버전에서 검증한 코어 무수정 경로 선택/확장 방식이 필요하다. 전체 사이트 테마를 바꾸거나 쿼리로 임의 테마를 선택할 수 있게 하지 않는다.
- 현재 준비 페이지의 메뉴는 유지. 독립 영카트 테마와 결제 정책의 실제 경로 연동 검증 이후에만 메뉴를 전환한다.
- 1차 실서버 조회: G5_GNUBOARD_VER 5.6.4, G5_YOUNGCART_VER 5.4.5.5.1, shop/ 및 관리자 파일 확인. 기존 g5_shop_* 런타임 키 미확인. 회원/포인트 테이블 MyISAM 확인. 상점 활성화/원자적 차감 가능 여부 미확인.
- 본 커밋의 독립 테마 헤더, 푸터, 홈은 개발용 뼈대이며 운영 설치 및 주문 연결 전이다. 쇼핑몰 테이블의 실제 이름과 테마 선택 훅 재조회가 선행된다.

## 운영 준비 화면 분리
- 독립 영카트 테마의 shop/index.php, shop.head.php, shop.tail.php 및 모바일 대응 파일을 동일 회원 인증 기반 준비 화면으로 배포. 메뉴는 theme/Busan_PointZone/pointzone.php로 전환. 기존 UXC 파일은 보존하되 활성 메뉴에서 제외.
- 영카트 자체가 활성화되지 않은 동안 사용하는 진입 컨트롤러는 구매/주문/DB 쓰기를 하지 않는다. 별도 쇼핑몰 엔진 아님. 실제 영카트 카탈로그·주문 통합과 순정 직접 경로 결제 차단 검증은 후속 단계.

## 상품 구성 보류 / 시스템 우선 (2026-11-25)
- 사용자 결정: 상품 종류·가격·수량은 시스템 구축 후 확정. 초기 상품 0개.
- 공식 gnuboard/gnuboard5 v5.6.4의 install/gnuboard5shop.sql에서 CREATE TABLE 24개만 추출하여 독립 검증용 InnoDB 스키마 작성. DROP/DELETE/INSERT 없음. 실제 기존 회원/포인트 테이블 변경 금지. 공식 설치 기본 접두사 yc5_ 추가 조회.
- 독립 테마 배포 중 메뉴 등록 HTTP 409 발생. 인증된 메뉴 트리 스냅샷을 SFTP로 웹루트 밖에 보존하고 스냅샷 해시를 대조한 뒤 해당 메뉴 URL만 전환하도록 수정.
- 실제 DB 스키마 적용/상품 등록/구매/포인트 차감은 아직 수행하지 않는다. DB 엔진·동시성·활성화·테마 라우팅 검증이 선행되어야 한다.

## 빈 쇼핑몰 DB 초기화 단계
- MariaDB 격리 테스트에서 공식 CREATE-only 스키마 24개 및 빈 상품·주문 테이블을 검증한 경우에만 운영 yc5_ 네이티브 테이블을 생성한다. 활성화 설정, 회원/포인트 원장, 상품 데이터, 결제 설정은 변경하지 않는다. 기존 접두사 충돌/부분 테이블 존재 시 중단한다. 설치 후 테이블별 InnoDB 및 컬럼·빈 행 검증 영수증이 필요하다.
- 메뉴는 기존 URL과 사용 여부를 확인하고 PC/모바일에서 표시되는 메뉴 순서를 별도로 검증한다. ETC가 마지막 기존 표시 항목인 경우에만 POINT ZONE 자체의 순서를 보정할 수 있다. 다른 메뉴는 변경하지 않는다.

## Native DB 설치 결과 및 기본 설정
- run 45526958644: MariaDB 격리 테스트 및 실제 서버 24개 yc5_ 테이블(InnoDB) 생성 검증 완료, 상품/주문 0, 영카트 활성화 false, 회원/포인트 변경 0.
- 다음 단계: 빈 yc5_default에 현금·PG·비회원 장바구니 비활성, 포인트 1P 단위 기본값만 초기화. 실제 결제 활성화는 금지. 상품·정책 콘텐츠는 사용자 기획 전 입력하지 않는다.
- ETC 뒤 메뉴 배치 실패 시 다른 메뉴의 순서를 변경하지 않고 POINT ZONE의 order 후보만 시뮬레이션한다. 안전한 후보가 없으면 읽기 전용 진단 결과만 반환한다.

## 2026-11-25 상품 관리 기반
- run 45527301403: 기본 설정 1행, 현금 결제 0, 비회원 장바구니 비활성, 상품·주문 0, 회원 포인트 변경 0. run 45527301409: ETC 뒤 7개 메뉴의 독립 테마 URL 전환 확인.
- 최고 관리자 전용 분류/상품 초안 등록·미공개 상품 가격/재고 수정 UI와 yc5 네이티브 테이블 연결. CSRF, 범위 검증, 트랜잭션, 권한 검증. 공개/구매/현금 결제 미지원. 운영 상품 및 분류를 자동 생성하지 않는다. 실제 DB 쓰기 기능은 격리 통합 검증 전 미검증 상태.

## Native 장바구니 기반 (검증 전)
- 영카트 yc5_cart/yc5_item/yc5_category 직접 연동 어댑터 및 격리 MariaDB 검증: 장바구니 추가·수량 수정·삭제, 회원 소유권, 재고, 서버 가격 재계산, 중복 행 방지, 포인트 잔액 부족 검증. 상품 옵션 및 배송 정책 미확정 경로는 거부한다.
- 실제 사용자 경로에 연결하지 않으며 상품·주문·포인트 실데이터에 접근하지 않는다. 회원/포인트 MyISAM 상태에서 실제 결제 차단을 명문화했다. 주문·취소·공통 원장 연동은 후속 개발.

## 주문 연동 격리 검증 / 운영 원장 전환 전 조건 (2026-11-25)
- 전용 개발 브랜치에 주문 수명주기와 SQL fixture 어댑터를 저장. 기존 회원/포인트 원장에는 연결하지 않음. fixture 잔액은 격리 테스트용이며 운영의 별도 원장으로 사용 금지.
- run 45531344897: PHP lint 및 순수 계약 테스트 통과. MariaDB 테스트는 차감, 원복, 재고, 중복 요청과 취소 상태 검사 후 마지막 MyISAM 변환에서 1071 오류(utf8mb4 PK 길이 제한). fixture 변환에서만 키 길이를 줄여 재검증하도록 수정(44e2e3bed1ae11985c9c91ba66b3b2c9d0fe59f5, run 45531789864). 최종 CI 결과 확인 전 통합 검증 완료로 표시하지 않는다.
- `scripts/busan_youngcart/live_ledger_metadata_readonly.php`: 운영 호스트 CLI에서만 테이블 엔진·필수 컬럼·인덱스 메타데이터를 조회. 실제 회원 행 및 인증정보 출력 없음. `point_writer_inventory_readonly.php`: 적립, 선물, AI, 원장 만료/취소 등 후보 경로와 파일 해시/줄 번호를 수집하는 읽기 전용 스캐너. 휴리스틱 결과만으로 완전한 커버리지나 동시성 보장을 주장하지 않는다. 둘 다 운영 실행 결과 미확인.
- 운영 원장 연결 전 필수: 실제 g5_member/g5_point 스키마와 기존 포인트 함수 및 모든 쓰기 경로 검토, 원장·회원 잔액 대사, 만료 및 차감 배분 원복 정책, 모든 쓰기 경로의 공유 잠금 및 원자적 트랜잭션 검증, 백업·원복 계획. 단순히 MyISAM을 InnoDB로 변경하는 것만으로는 충분하지 않다. 운영 DDL/실포인트 수정/결제 활성화 금지 상태 유지.

## Native single ledger integration (development only)
- CI 45531789864 passed isolated purchase/reversal; 45534675394 passed concurrent order/reversal/stock tests; 45535351971 passed read-only member/admin views.
- Live audit 45535376037: pinned SFTP authentication verified, 90 candidate source files inspected, 21 matches, no read errors, 13 omitted; remote CLI metadata did not return a usable receipt. Earlier live audit 45527741652 confirmed member/point MyISAM and yc5 native shop tables InnoDB. No exhaustive writer review yet.
- `native-point-ledger.php` implements the shared native `g5_member.mb_point` and `g5_point` integration on one PDO transaction, based on official v5.6.4 schema and native functions. No second operating point balance. Native debit event and original lot allocations are retained in the order receipt. Reversal appends positive point entries with original expiry and does not double-release old allocations. Existing ledger discrepancy, overdue or inconsistent lots, nontransactional storage and duplicate debit fail closed. Reversal of already-expired allocations is held for explicit policy/implementation review, not silently credited or discarded.
- Native adapter is wired to the isolated order transaction port and official schema fixture; run 45535758300 is the required native integration test receipt. Production port and its persistent order metadata, approved core-compatible shared writer locking, migration/backups and post-migration reconciliation remain required. Do not mark live checkout ready or apply DDL merely because isolated tests pass.

## 최종 채택 방식 — 기존 포인트 유지 / 영카트 호환 (사용자 정정)
이 절은 이전 직접 원장·InnoDB 전환 설계를 대체한다. 회원/포인트 스키마와 기존 코어는 변경하지 않는다. 영카트만 기존 insert_point() API를 호출한다. 이전 직접 원장 구현은 테스트 기록으로만 보존하고 배포 패키지에서 제외한다.
- run 45536642666: 순정 그누보드 포인트 함수와 MyISAM 격리 환경에서 구매·반환·멱등성 검증 통과.
- run 45537120512: 관리자 확인 대기 주문 복구 테스트 통과. 기존 포인트 원장에 검증된 거래가 있을 때 영카트 상태만 복구.
- run 45537371523: 결제 요청 필드, CSRF, 회원/관리자 권한, PHP 문법 및 배포 패키지 검증 통과.
- 추가 HTTP 렌더 테스트는 격리 MariaDB와 임시 native common bootstrap을 사용하며 실제 운영 회원 로그인 검증이 아니다.
- 운영 원장 변경 없음. 결제 기능 잠금 유지. 독립 기존 포인트 쓰기 경로와 동시 차감 검증, 운영 설치 API 확인, 영카트 영수증 테이블 설치 및 화면 확인이 남아 있다. 이전 원장 전환 계획을 실행하지 않는다.

## 2026-11-25 사용자 재확정: 빈 데이터 상태에서도 전 메뉴 기능 구현
상품 종류·가격·수량 및 실제 행사 데이터는 비워 둔다. 메뉴 링크와 준비 중 안내만으로 구현 완료 처리 금지. 7개 화면의 실제 조회/회원 동작/관리자 운영 흐름 및 빈 상태 검증을 완료 기준으로 삼는다.
- 상점: 분류/상품/재고, 장바구니, 구매/취소, 주문 관리.
- 경매: 경매 등록, 일정/입찰 조건, 입찰 내역, 마감/낙찰, 기존 포인트 정산/반환 안전 검증.
- 나눔: 캠페인 등록/마감, 참여/나눔 내역, 기존 포인트 정책 검증.
- 이벤트: 등록/일정/참여/정원/마감/포상 관리.
- 꾸미기: 영카트 상품 연결, 기간/영구 권한, 소유 내역, 적용/만료/취소.
- 명예의 전당: 기존 활동/기여 기준을 확인하여 랭킹 조회 및 집계 구현. 실제 순위 기준은 미확정.
- 나의 포인트존: 주문, 입찰, 나눔, 이벤트 참여, 보유 꾸미기, 기존 원장 확인.
이 목록은 구현 범위이며 입찰 차감 시점, 보상 방식, 순위 산정 등 미확정 정책을 임의로 운영에 활성화하지 않는다. 기존 포인트/코어 변경 금지.
현재 feature-only 스키마 및 활동 초안 관리, 무료 이벤트 참여/중복 및 정원 제어, 회원별 참여/보유 내역 조회 소스 추가. 테스트 실행 결과 및 운영 설치 미확인. 운영 SFTP의 지정 사이트 루트 포함 모든 검사 경로가 45555478323에서 missing, 게스트 URL은 7개 로그인 안내 반환. 다른 계정/경로로 우회하거나 운영 데이터를 추가하지 않는다.

## 2026-11-25 사용자 추가 지시: 테스트용 샘플 상품 허용
실상품 구성은 미정 유지. 격리 DB에 [샘플] 상품 7종(일반 2종, 기간제/영구 꾸미기 2종, 한정재고·품절·고가 각 1종)을 생성하고 자동 구매/취소/재고/잔액부족/기간만료 검증을 수행한다. 샘플 가격·수량은 검증용 임시값. 운영용 상품 및 실제 회원 포인트에는 반영하지 않는다. 운영 화면 샘플 등록은 서버 접근 복구와 노출 범위 검증 후 별도 단계. 이전 통합 검증 run 45564633991 성공 확인.

## 2026-11-25 최우선 구현 원칙 재확정 — 순정 영카트 기능 우선
사용자 정정: 영카트를 설치한 목적은 DB만 재사용하는 것이 아니라 기존 기능을 최대한 이용하는 것이다. 이 절은 이전 자체 장바구니·주문 엔진을 운영 목표로 삼던 계획을 대체한다.
- 상품/분류/옵션/재고/이미지/장바구니/주문/취소/배송/상품평 등 영카트에 있는 기능은 순정 관리자, 쇼핑몰 라이브러리, 실제 처리 경로 및 세션 규칙을 우선 사용. 기존 사이트 헤더/푸터와 테마·스킨으로 화면을 통합한다. 동일 기능을 별도 엔진으로 재작성하지 않는다.
- 기존 g5_member/g5_point, 포인트 적립·선물 정책, 코어 파일을 변경하지 않는다. 현금/PG/비회원 구매 금지, 기존 포인트 전액 결제 및 원 결제액 반환만 허용. 순정 영카트의 포인트 처리 및 공식 확장 지점을 설치 버전 기준으로 검증하고 필요한 정책 차이만 최소 확장한다. PC/모바일/직접 URL 우회 검증 전 활성화 금지.
- 경매·나눔·지부장 이벤트·꾸미기 권한·명예의 전당은 순정 기능으로 해결되지 않는 부분만 확장. 기존 포인트 및 영카트 상품/주문을 재사용. 자체 잔액·상품/주문 중복 원장 금지.
- Work 운영 배포 run 45567541713, 45579451269: 샘플 7종 등록/재확인 및 이미지·상세 화면 반영 성공. 그대로 보존한다. 새 자체 장바구니 수정본(62bfbd003b41457656d4638030e436b47e56ab05) 격리 검증 45580358832 성공했으나 순정 기능 우선 재검토 전 운영 배포하지 않는다. 이전 자체 정산/장바구니 코드는 검증 참고 자료로 보존하고 순정 기능 전환 검증 이후 불필요한 부분을 정리한다.
- 현재 운영 G5_USE_SHOP 비활성 상태로 설치되어 있으므로 실제 shop.config.php와 g5_shop_* 매핑, 관리자/PC/모바일 경로 및 확장 훅을 읽기 전용 확인하고, 순정 쇼핑몰 활성화가 기존 홈페이지 및 현금 결제 차단 조건을 충족하는지 먼저 판단한다. 임의로 플래그를 켜거나 운영 포인트를 차감하지 않는다.

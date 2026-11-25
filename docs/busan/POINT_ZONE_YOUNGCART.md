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

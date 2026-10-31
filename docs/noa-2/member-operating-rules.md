# NOA STUDIO 회원 운영규칙 관리

회원에게 공개하는 등급·임명·칭찬포인트 기준은 [별무리 회원 운영규칙](https://noastudio.ai.kr/noa-membership.php#fan-rules)에서 관리한다. 회원별 임명 결과는 정책 문서에 기록하지 않는다.

| 변경 대상 | 기준 소스 | 함께 확인할 곳 |
|---|---|---|
| 1~10레벨 공식 호칭과 기능 접근 | `bridge/member-access.php` | 회원 안내 목록은 `NOA_MEMBER_TITLES`에서 읽는다. |
| 6레벨 및 5레벨 임명, 칭찬포인트 지급과 반환 | `bridge/fan-membership.php` | `deploy/noa-membership.php`의 회원 운영규칙과 임명·선물 화면 |
| 등급 배지와 프로필 | `bridge/member-badges.php`, `deploy/noa-member-badges.css` | 프로필, 게시글 닉네임, MY 카드 |

6레벨 스타 클러스터는 팬클럽의 여왕, 5레벨 갤럭시 회원은 여왕을 보좌하는 간부다. 최고 관리자만 회장(6레벨)을 임명하고, 각 회장만 자신의 보좌관(5레벨)을 동시에 최대 2명까지 임명한다. 9·10레벨은 팬클럽 운영을 지원하며, 임명 권한은 서버의 역할 검사를 따른다. 4·8레벨은 VIP 배지를 사용한다. 운영규칙을 바꿀 때에는 회원 안내와 실제 권한·포인트 처리 결과를 함께 대조한다.

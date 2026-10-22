# 부산지부ON 활동 계정

사용자 승인: 홈페이지 전체 관리 챗비서의 전용 활동 계정과 메인 심볼 프로필 지정.

- 대상 홈페이지: https://skhnslu-busan.com
- 활동 회원 아이디: `busanjibuon`
- 이름·닉네임: `부산지부ON`
- 회원 레벨: `10`
- 기존 `cf_admin` 소유자 유지. 레벨 10은 그누보드의 단일 최고관리자 `cf_admin` 소유권을 교체한다는 뜻이 아니다.
- 프로필 원본: `/Custom/img/icon-512.png` (홈페이지 주황색 ON 메인 심볼)
- 그누보드 프로필: `/data/member_image/bu/busanjibuon.gif`
- 그누보드 아이콘: `/data/member/bu/busanjibuon.gif`
- 비밀번호는 그누보드 기본 암호화 함수로 저장. 원문 인증정보·상태 조회 토큰은 웹루트 외부, 계정 소유자 전용 파일에서만 관리하며 로그·채팅·저장소에 기록하지 않는다.
- 보호된 `/busan-assistant/activity.php`는 전용 활동 계정을 검증하고 운영 현황만 반환한다. 토큰 없는 요청은 차단한다.
- 현재 연결 범위는 `status:read`. 자동 게시·회원 등급 변경·삭제 등 쓰기 API가 구현되었다고 주장하지 않는다.
- 향후 작성·변경 기능은 이 계정을 활동 주체로 기록하고, 작업 결과를 실제 운영 환경에서 검증한다. 기존 회원을 임의로 활동 계정으로 대체하지 않는다.
- 개인 민원·비밀글·지점별 소속 제한은 유지한다.

검증: native get_member, native check_password, native get_member_profile_img, 레벨 10, 소유자 유지, 보호된 연결에서 활동 주체 확인.

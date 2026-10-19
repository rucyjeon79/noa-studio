# 5. MySQL과 PHP API 설계

스키마 파일: `database/migrations/001_noa_studio.sql`. 운영 DB에는 실행하지 않았다.

테이블은 `noa_songs`, `noa_acts`, `noa_settings`, `noa_originals`, `noa_assets`, `noa_save_history`, `noa_migration_log`다. 그누보드 테이블은 수정하지 않는다. 곡의 기존 필드는 `pkg` JSON에 그대로 둔다. 모르는 필드를 삭제하지 않는다.

API 파일: `deploy/noastudio/api/index.php`. 닷홈에는 아직 올리지 않았다. 이 환경에 PHP가 없어 문법 실행 테스트는 하지 못했다.

| 호출 | 권한 | 동작 |
|---|---|---|
| `GET op=genres` | 공개 | 이관된 장르 수만 |
| `GET op=songs&genre=` | 공개 | 제목, 번호, 확정, 버전, 유튜브, 썸네일 |
| `GET op=song&key=` | 공개는 일부 필드, 관리자는 `pkg` 전체 | 저장본 재조회 |
| `POST op=song` | 그누보드 관리자 또는 회원 레벨 10 이상 | `savedKeys`만 반영 |

저장 규칙:

- 요청에 `baseRev`가 있어야 한다.
- 행을 잠그고 `rev`가 다르면 파일을 바꾸지 않고 `conflict`를 반환한다.
- 요청에 없는 필드는 그대로 둔다.
- `null`로 필드를 지우지 않는다. 비울 때는 빈 문자열을 보낸다.
- 바꾼 뒤 같은 행을 다시 읽어 값이 같을 때만 `written`이다.
- 값이 같으면 `unchanged`다.
- 이력에는 필드 이름과 결과만 남긴다. 비밀번호는 남기지 않는다.

허용 Origin은 `https://noastudio.ai.kr`와 `https://noa-studio.grok.me`뿐이다.

모바일 앱의 저장 경로는 아직 이 API로 바꾸지 않았다. API가 닷홈에 없고 데이터도 이관되지 않았기 때문이다.

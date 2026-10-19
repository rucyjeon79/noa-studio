# 3. 데이터·이미지·설정 승계표

원본 JSON은 이관 후에도 `data/live`에 둔다. 이번 단계에서는 복사하거나 삭제하지 않았다.

## 곡

| 대상 | 승계 | 비고 |
|---|---|---|
| 653개 곡·ACT·사연 파일 | 파일 유지, 이후 `pkg` JSON 통째 이관 | 없는 필드를 만들지 않음 |
| 확정 63 | 파일의 `confirmed`를 기준으로 보존 | 자동 해제 금지 |
| 제목 653 | `title`과 `pkg.confirmedTitle` 둘 다 유지 | |
| 유튜브 415, 수노 491 | 곡 `pkg` 값 유지 | 상태 목록과 다르다고 덮지 않음 |
| 고음질 플래그 | 파일에 없음 | 기본값 true로 만들지 않음 |
| 원곡 40 | `noa_originals` 후보 | K-POP만 존재 |

## 설정

공통 설정 28키는 모두 유지한다. 지정된 10개 필드는 공통에 모두 있다.

`fixRule`, `descRules`, `communityRules`, `thumbImage`, `thumbFont`, `thumbLayout`, `outputOrder`, `thumbCastRule`, `fillAudit`, `fieldAudit`, `lockRule`.

장르 파일 15개 중 7개만 이 긴 규칙을 갖고 있다. 없는 8개 장르에 공통 규칙을 지금 채워 넣지 않는다.

없는 장르: `jpop-original`, `pop-original`, `thai-original`, `edm-kpop-club`, `narrative-piano-indie`, `echoes-of-joseon`, `your-story`, `cover-reborn`.

있는 장르: `kpop-original`, `joseon-ballad`, `panpop`, `latin-afrobeats-edm`, `dreamy-deep-house`, `fantasy-ambient-edm`, `groovy-airy-pop`.

## 이미지

| 자산 | 수 | 처리 |
|---|---:|---|
| `public/characters` | 9 | NOA·NOEL 얼굴·측면을 PC 테마에 복사 |
| `public/splash` | 90 | 1.0 유지. 이번 배포 묶음에 넣지 않음 |
| `public/coming` | 14 | 1.0 유지 |
| 곡 `thumbUrl` | 54 | 주소만 승계. 임의 이미지 생성 안 함 |

## 인증정보

`상태.json`의 게이트 비밀번호와 보안키는 승계 대상이지만 문서, API, GitHub Secrets 안내문 값으로 옮기지 않는다. 값의 존재만 확인했다. 게이트 비밀번호 문자열은 비어 있고, 보안키 문자열은 있다.

# 통합 인기순위 · 시간별 스냅샷

기존 SQL 분류·확정 곡 매칭·수집 checkpoint를 재사용한다. 음악 플레이어·스트리밍·업로드·FIFO·디자인 파일은 이 작업에서 수정하지 않는다. 세계관 EP/ACT 기본 순서도 유지한다.

## 집계 범위와 API 계약

- 점수는 공식 공개·재생 허용 영상의 기록된 조회수 + 유효 재생 원장 건수다. 조회수가 누락된 영상은 추정하지 않고 제외한다. 일반 EP 영상과 MV는 별도 video ID를 유지한다.
- 곡 합계는 확정 연결된 video ID의 집합 + 해당 song ID의 유효 재생수다. 장르·컬렉션·공식 목록 합계는 각각 video ID와 song ID 집합으로 계산한다. 하위 카테고리/행의 점수를 단순 합산하지 않는다.
- 영상 순위 행의 JUKEBOX 지표는 연결 곡의 유효 재생수다. 같은 곡의 일반 영상과 MV가 각각 그 곡 지표를 표시할 수 있다. **영상 순위 행의 점수를 다시 합산해서 곡/장르/전체 합계를 만들면 안 된다.** API의 `totals`와 `songs`, `genre_totals`를 사용한다.
- 공식 재생목록은 중복 없는 공개 수록 영상 조회수 + 중복 없는 연결 곡 유효 재생수다. 재생목록 자체의 별도 조회수는 더하지 않는다. 연속듣기 단일 영상은 해당 영상 지표다. 서로 다른 콘텐츠 유형·`scoreKind`를 제공한다.
- `genres`: 기존 4개 Original 장르. `collections`: SQL collection 관계로 확인한 기존 컬렉션 장르. `genre_totals`: 사연곡·커버곡을 포함한 전체 기존 장르 합계. 기존 장르·언어·버전은 변경하지 않는다.
- `featured`, `ep`, `stories`, `covers`, `playlists`, `genres`, `collections`, `genre_totals`, `jukebox`, `mv`, `songs`를 `/noa-bridge/rankings.php?type=...&limit=10`에서 제공한다. 최대1000행이며 기본10행이다.
- `stories`와 `covers`는 각각 수집된 공식 공개 재생목록 소속을 요구한다. 커버는 기존 SQL 분류도 확인한다. 추천10개 video ID는 EP·사연곡·커버에서 제외하고 다음 후보로 보충한다.
- 행: `contentId`, `title`, `contentType`, `rank`, `previousRank`, `rankDelta`, `rankState`, `youtubeViews`, `jukeboxPlays`, `score`, `aggregatedAt`, `youtubeSyncedAt`, `rulesVersion`. 기존 홈 카드의 title/href/thumbnail/views/videoId 필드도 유지한다.
- 응답: `items`, 실제 반환 `count`, 해당 그룹 `totalCount`, 1위 `featuredContent`, 집계 시각, 데이터 오래됨 여부, 수집 연결 상태. `movementIcons`는 디자인 담당의 표시 계약이다. up=trending-up/green, down=trending-down/red, same=minus/gray, new=NEW, unknown=null.
- 홈 API는 마지막 공개 스냅샷을 읽는다. 아직 정상 스냅샷이 없으면 기존 홈 조회를 유지한다. 세계관 인기 API `type=mv`는 기본 스토리 순서와 독립적이다. 장르 카드·세계관 인기 탭의 실제 UI 연결은 디자인 담당에게 이 계약을 제공한다.

## 시간·트랜잭션·재실행

UTC 정각(한국도 같은 정각)을 집계 기준으로 하고 실제 실행시각을 별도로 저장한다. 기준시각 이전에 commit된 최신 YouTube 수집과 기준시각 이전 유효 재생만 사용한다. 누락된 과거 시간의 조회수를 현재 값으로 소급 생성하지 않는다.

직전 **정확히 한 시간 전** 공개 스냅샷만 비교한다. 없으면 unknown, 직전에는 없고 현재 있으면 new, 그 외 이전순위-현재순위로 up/down/same이다. 동점은 content ID 오름차순이다. 명명 잠금 + REPEATABLE READ + 트랜잭션 + 시간/그룹/콘텐츠 유일키를 사용한다. 공개 완료된 시간은 재실행해도 보존하고 실패한 집계만 재시도한다. 잘못된 집계·실패는 공개하지 않고 정상 스냅샷과 오류 이력을 남긴다.

GitHub Actions 매시간 0분 예약은 닷홈의 기존 SFTP·서명 서비스 경로를 사용한다. GitHub 예약은 지연/누락될 수 있으므로 정각 실행 SLA를 보장한다고 보고하지 않는다. `computedAt`, `rankingStale`, 직전 시간 유무로 실제 지연을 드러낸다. 계정의 닷홈 native cron 사용 권한/상품이 확인되기 전 native cron 설치를 완료로 보고하지 않는다. SQL 잠금은 commit/rollback과 별도로 finally에서 해제한다.

## 추가 테이블 · 기존 데이터 보호

`noa_popularity_settings`, `noa_play_sessions`, `noa_valid_plays`, `noa_ranking_runs`, `noa_ranking_rows`, `noa_ranking_errors` 총6개. 기존의 카테고리·곡 매칭·YouTube 관계·JUKEBOX 처리 이력과 중복하지 않는 역할이다. 최초 정책은 INSERT IGNORE이며 운영 수정값은 재배포로 덮어쓰지 않는다.

실제 운영 적용 전 현재 전체 DB를 private 백업하고, 그 정확한 SHA의 백업을 격리 MySQL에 복원·스키마·전체 행 체크섬 검증한다. 격리에서 기존 전체 데이터와 분류9개 테이블을 대조한다. 운영에서는 catalog·분류/확정 관계·회원 해시를 적용 전후 확인하되 실행 중인 미디어 큐를 잠그거나 중단하지 않는다. 변경 코드 경로는 새 모듈과 홈 API 연결 파일만 SHA 비교 후 원자적으로 적용한다.

## Work_뮤직 연결 계약 · 아직 플레이어 코드를 변경하지 않음

초기 `playbackIntegrationEnabled=false`다. 이때 JUKEBOX 수치는 비어 있는 원장에서 집계한0건이며 **기존 사용자 재생이0회였다는 뜻이 아니다.** `jukeboxCollectionStatus=awaiting_music_integration`을 반드시 보존한다. 실제 연결 검증 전 enabled로 표시하지 않는다.

1. 동일 origin·동일 GnuBoard 세션으로 `GET /noa-bridge/popularity-events.php`에서 CSRF 토큰을 받는다.
2. 음원 재생 직전에 POST JSON `{action:"start",songKey:"기존 JUKEBOX 키"}`와 `X-NOA-Play-CSRF`를 보낸다. 서버는 공개곡·ready 음원·확정 canonical 곡 연결을 확인하고 일회용64hex token을 반환한다. 관리자 재생은 제외된다. 토큰은 URL/query/log에 남기지 않는다.
3. **Work_뮤직 서버 전송 코드**가 검증된 MP3의 실제 성공 GET 전송 시작 지점에서 `popularity-plays.php`의 `np_stream_started($db,$token,$songKey,$isAdmin,time())`를 호출한다. HEAD/실패/커버 요청에서는 호출하지 않는다. token 전달은 같은 origin의 재생 요청 헤더 또는 서버 측 세션 연결로 구현하고 사용자 입력으로 공개 서버 확인 API를 만들지 않는다. start 응답 시 서버 세션의 `$_SESSION['noa_popularity_pending'][$songKey]`에 `{token,createdAt}`를 저장하므로 native audio는 별도 인증정보를 URL로 보내지 않고 이 값을 읽어 연결할 수 있다. 성공적인 hook 호출 후 해당 pending 항목만 소비한다. 이 hook이 없으면 공개 progress 이벤트만으로는 유효 재생이 될 수 없다.
4. 실제 audio `playing` 이후 최소10초마다 `{action:"progress",token,position:audio.currentTime,event:"progress"}`를 보낸다. pause/ended/error 시 해당 event를 보낸다. 이벤트 경로는 실제 소리를 틀거나 플레이어 상태를 바꾸지 않는다.
5. 인정 시간 기본30초. 서버 경과시간과 미디어 재생위치 증가를 함께 확인하고 큰 seek·20초 초과 heartbeat 공백·pause는 적립하지 않는다. 서버 확인 전·실패·짧은 종료는 제외한다. 세션 최대30분, 같은 actor/곡30분 cooldown, actor당 시간20건 인정/60회 시작 제한. 원문 IP/회원 ID/UA는 저장하지 않고 서버 비밀키로 HMAC 처리한 actor만 저장한다. 익명은 IP+UA 기준이므로 공유 네트워크에서 보수적으로 제한될 수 있다.
6. Work_뮤직이 실제 MP3 이벤트와 서버 hook 연결을 검증한 후 최고관리자 정책에서 enabled를 켠다. 이 작업은 다른 담당의 스트림/플레이어를 임의 수정하지 않는다.

관리자 `/noa-app/popularity/`: GnuBoard super 및 cf_admin ID 일치, 세션·same-origin·CSRF 필수. 상태·통계·오류·제외 사유·정책 revision·현재 시간 재집계를 제공한다. DB 비밀번호와 서비스 키는 노출하지 않는다.

## 검증

순수 테스트는 조회수·재생수 합계, 영상/곡 집합 중복 방지, 다중 카테고리, 상승/하락/유지/신규/비교불가, 안정 동점, 추천 중복 제외/10개 보충, MV ID 독립, 스트림 증거·seek·공백·재생 실패를 확인한다. 실제 최신 백업의 격리 SQL 테스트는 추가형·재실행·정책 보존·실제30초 이벤트1건·중복/관리자/refresh 제외·인접시간 비교·1위 대표 데이터·기존 데이터 불변을 확인한다. 이 테스트의 합성 재생은 격리 DB에만 저장한다.

운영 관리자 로그인 편집은 인증 브라우저가 확보돼야 별도로 확인할 수 있다. 격리 UI 테스트 결과와 운영 인증 화면 조작 결과를 혼동하지 않는다. 배포 및 실제 검증 결과는 실행 후 아래에 추가한다.


### 최초 격리 검증 · 운영 SQL 적용 전 차단

실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39610960772 에서 현재 DB76개 테이블·31,092행·140,536,759 bytes의 private 백업 `58d7b6da709352ebf7c1b81dfe3e1eafe92ab89ee26764bd52af5e94bb75c6c6`를 실제 격리 복원했고 스키마·전체 행 체크섬이 일치했다. 수집 checkpoint는 stage=done, 기존605곡 유지였고 기존 인기순위/유효 재생 테이블은 없었다. g5_popular는 그누보드 검색어 통계로 재사용 대상이 아니다.

공개 heartbeat가 보낸 위치를 verified stream 시작 시 초기화하지 않으면 첫10초를 누락하는 결함을 실제 SQL 이벤트 테스트가 발견했다. 운영 SQL 적용·홈 연결 단계는 실행되지 않았고, 새 모듈만 준비된 상태로 남았다. hook에서 위치·credit 기준을0으로 초기화해 수정한다. 같은 최근 백업의 무결성/복원을 다시 검증하여 사용하며 유효기간이 지났으면 새 백업을 생성한다.

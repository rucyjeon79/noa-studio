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


공개 순위의 영상 목록은 새 수집이 들어오면 최신 공개 상태를 다시 확인한다. 최신 수집에서 사라진/비공개/삭제된 영상의 행은 이전 스냅샷에 있더라도 즉시 숨긴다. 시간별 원본 순위는 변경하지 않는다. 이 경로를 별도 격리 SQL 트랜잭션에서 검증하며, 테스트용 수집 행은 rollback해 기존 수집·매칭을 보존한다.


`integrated-v2`는 기존 `noa_playlist_matches`의 확정 ACT 영상→장르 연결도 읽는다. 개별 곡이 미매칭이어도 이 확정 장르의 영상 조회수를 장르 합계에서 누락하지 않으며, 이 관계로 곡 ID를 새로 만들지 않는다. 규칙 버전이 달라진 직전 시간과는 상승·하락을 비교하지 않고 unknown(`comparisonUnavailableReason=rule_version_changed`)으로 제공한다. 공개 완료한 v1 시간을 덮어쓰지 않는다.

장르·컬렉션 API는 `items`에 실제 점수·순위가 있는 항목, `cards`에 인기순 항목과 지표 미확인 기존 등록 장르를 이어 제공한다. `cardCount`는 기존 카드 전체 수, `unrankedCount`는 점수를 만들지 않은 카드 수다. 지표가 미확인인 기존 등록 장르는 score/youtubeViews/jukeboxPlays/rank=null, rankState=unknown이다. 실제 기존 컬렉션9개를 유지하면서도 확인되지 않은 조회수를0으로 만드는 일을 피한다. 디자인 담당은 이 순서의 `cards`, `cardCount`, `featuredContent`로 카드 균형 정렬을 연결한다.


### 실제 운영 적용 · 2026-10-21 23:01 KST

최초 운영 SQL 생성 커밋 `732b6c8010bf6a37dc194b4ba99e05c911b055f1`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39611688984 성공. 최종 런타임 `93975be4ca703685c1de44b5113633673768a6c7`, 실행 https://github.com/rucyjeon79/noa-studio/actions/runs/39612761812 성공.

- 적용 직전76개 테이블·605곡 → 현재82개 테이블·605곡. 본 모듈6개만 추가했고 기존 확정 분류·곡 매칭·제작 규칙·회원 해시는 적용 전후 일치했다. 기존 음원·큐·디자인 파일은 변경하지 않았다.
- private 백업140,536,759 bytes /76개 테이블/31,092행의 정확한 격리 복원·스키마·전체 행 체크섬 검증 성공. 기존 데이터와 분류9개 테이블 불변, 정책 재배포 보존,30초 유효 재생·중복·관리자·짧은 반복 제외, 시간별 재실행·비교·새 수집 개인정보 보호 경로 검증 성공. 테스트용 재생1건은 격리 DB에만 존재하고 운영에 복사하지 않았다.
- 운영 스냅샷: 22:00 KST(v1, 실제22:53:38 계산),23:00 KST(v2, 실제23:00:39 계산)2개 / 순위 행948개. 현재 공식 공개610개 영상의 조회수187,978 + 운영 유효 재생 원장0 =187,978. 원장0은 **연결 대기 상태**로, 기존 JUKEBOX 실제 청취가 없었다는 보고가 아니다.
- 두 시간의 집계 규칙 버전이 다르므로 현재 변동은 unknown, `comparisonUnavailableReason=rule_version_changed`다. 실제 상승/하락으로 위장하지 않는다. 같은 v2의 다음 시간부터 인접 시간 순위를 비교한다. 격리에서는 같은 버전 인접시간 비교와 up/down/same/new/unknown을 검증했다.
- 순위 후보: 추천10·EP10·사연곡10·커버곡10·연속듣기/공식 목록28(홈은 상위10)·오리지널 장르4·지표 확인 컬렉션7·MV30·곡별 합계352. 전체 기존 컬렉션 카드는9개를 유지하며 나머지2개는 지표 미확인으로 score/rank=null이다. 사연곡·커버의 공식 소속 및 추천 video ID 중복 제외 확인.
- 실제 공개 API의 점수 합계·안정 정렬·중복·1위 대표 데이터·홈 동일 스냅샷 연결·익명 관리자403·무서명 서비스401·재생 이벤트 CSRF403을 확인했다. 격리 관리자 템플릿의 PC/모바일 정책 저장·현재 시간 재집계·순위 선택 상호작용 및 화면 확인 성공. 운영 관리자 계정으로 로그인한 실제 UI 편집은 미검증이다.
- 매시간0분 GitHub 예약을 등록했다. workflow 변경 시 동일 고정 집계/검증 경로를 즉시 실행하도록 설정해 실제 서비스·SQL replay를 확인한다. 예약 지연은 실행시각과 stale 플래그로 드러내며 과거 시간을 임의 생성하지 않는다.

### 남은 담당별 연결 사항

Work_뮤직: 위 서버 세션 pending token + 검증된 실제 MP3 GET 전송 hook + playing/progress/pause/ended/error 이벤트를 본인 코드에서 연결하고 검증 후 정책 활성화. 현재 수집은 의도적으로 꺼져 있으며 기존 업로드/FIFO/플레이어를 본 작업에서 수정하지 않았다.

Work_디자인: `/noa-bridge/rankings.php`의 정렬된 `cards`/`cardCount`/`featuredContent`, 각 행 `rankState`/`rankDelta`와 `movementIcons`를 카드 및 아이콘 표시로 연결한다. 세계관 인기 조회는 `type=mv`만 별도로 사용하고 기본 EP/ACT 스토리 순서를 바꾸지 않는다. 현재 데이터·API 준비와 실제 아이콘/카드 UI 반영 완료를 구분한다.

최고관리자 로그인 후 실제 편집 검증, 최초 GitHub schedule 이벤트 관찰 및 같은 규칙 다음 시간의 실운영 비교 결과는 별도로 확인해야 한다. 이 세 항목과 위 타 담당 연결을 완료로 표시하지 않는다.


2026-10-21 23:04 KST의 시간별 worker 경로 검증: 커밋 `42b692e84d90514bc3e0041121199c0e972cef12`, https://github.com/rucyjeon79/noa-studio/actions/runs/39613506732 성공(push 이벤트). 실제23시 SQL 결과의 `replayed=true`를 확인했고 스냅샷2개·948행을 중복 생성하지 않았다. 최초 schedule 이벤트 성공을 관찰한 기록과 구분한다. 현재 점수 미확인 컬렉션2개는 Joseon Ballad40곡과 PANPOP40곡이다. 곡 등록은 보존되며 확정 공개 영상 지표의 장르 연결 근거가 부족하므로 점수/순위를 만들지 않았다.

다음 배포가 이미 생성된6개 테이블·과거 순위·유효 재생 원장을 만났을 때도 안전한지 전용 source/replay 검증을 추가한다. 격리 DB에서 같은 SQL 테스트를 두 번 연속 실행해 최초 생성과 기존 모델 데이터 보존을 함께 확인한다. 미래 시간 테스트 자료는 격리 DB 안에서만 사용하고 운영으로 복사하지 않는다.


홈의 기존 `noa-home.js`와 호환되도록 읽기 adapter를 둔다. 단일 연속듣기 영상은 기존 `scoreKind=video_view_count` 및 countedVideos=1을 유지하고, 통합 지표 종류는 `integratedScoreKind`로 보존한다. 공식 사연곡·커버 카드의 장르 표시도 곡 매칭 유무와 분리해 공식 소속으로 표시한다. 저장된 스냅샷 점수/순위는 수정하지 않는다. 현재 JUKEBOX 수집이 꺼져 있는 동안 기존 ‘조회수’ UI 문구가 잘못된 재생 합계를 표시하지 않으며, 활성화 전 디자인 담당은 `score`와 통합 점수 문구를 연결해야 한다. 실제 운영 홈 PC/모바일50개 카드의 ID·제목·지표 문구 일치와 undefined/NaN 부재를 추가 검증한다.

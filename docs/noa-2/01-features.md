# 1. 기존 1.0 기능 목록

기준 커밋 `95a95fd`. 화면은 `/`의 StudioApp 하나와 `/settings`다. 기능은 소스에 있는 것만 적었다.

| 기능 | 상태 | 2.0 처리 |
|---|---|---|
| 스플래시, 장르 선택, EP 목록, ACT 목록 | 그대로 승계 | PC는 새로 구현, 모바일 유지 |
| 사연곡·커버곡 목록 | 그대로 승계 | 공통 API |
| 결과창: 제목, 가사, 설명, 수노 스타일, 제미니 프롬프트, 유튜브 제목·설명, 팬레터, 트랙리스트, 커뮤니티 | 개선 후 승계 | 곡 JSON의 `pkg`가 원본 |
| Suno URL, YouTube URL, MV URL, 썸네일 주소 | 개선 후 승계 | 부분 저장 |
| 확정, 잠금, 설정 잠금 | 그대로 승계 | 확정 63건은 파일과 `확정.json`이 일치 |
| 주크박스, 음량 분석, 음원 보정, WAV 저장 | 모바일 전용 유지 | 브라우저 오디오. PHP로 옮기지 않음 |
| 유튜브 미리듣기, 한 곡 반복, 순차, 셔플 | 모바일 전용 유지 | 공식 플레이어 정책 밖 우회는 하지 않음 |
| 공통 설정, 장르 설정 | 그대로 승계 | 곡 파일에 복사하지 않음 |
| 자동 채우기, 검수, 재생성 | 실행 환경 확인 필요 | 현재 Node 서버 기능. 닷홈 상시 Node는 없음 |
| 번역 보기 | 브라우저와 서버 혼합 | 화면 문구 121키 |
| NOA·NOEL 썸네일 캐스트 | 그대로 승계 | 기존 이미지 사용 |
| 원곡 정보 | 그대로 승계 | K-POP 40개만 파일 존재 |
| 관리자 게이트, 메일, 설치 안내, 버전 표시 | 모바일 전용 유지 | 비밀번호는 문서와 API 응답에 넣지 않음 |
| 탐색기식 라이브 파일 화면 | 개선 후 승계 | 파일 쓰기는 MySQL 전환 전까지만 |
| PGLite `studio_pages` | 공통 API 전환 후 쓰기 중단 | 최종 원본이 되면 안 됨 |

장르 15개: `kpop-original`, `jpop-original`, `pop-original`, `thai-original`, `joseon-ballad`, `panpop`, `echoes-of-joseon`, `latin-afrobeats-edm`, `edm-kpop-club`, `dreamy-deep-house`, `fantasy-ambient-edm`, `groovy-airy-pop`, `narrative-piano-indie`, `your-story`, `cover-reborn`.

Node가 필요한 기능: 파일 JSON 저장, PGLite, Suno·YouTube 음원 프록시, xAI 패키지·이미지 생성, 자동 채우기 워커. Grok 앱 배포본이 그 실행 환경이다. 닷홈이 같은 Node를 항상 켜 준다고 보지 않는다.

브라우저만으로 가능한 기능: 목록 UI, 재생 조작, 음량 표시, 편집 초안, 화면 번역 토글.

PHP로 옮길 기능: 장르·곡·ACT 조회, 부분 저장, 버전 충돌, 설정 저장, 그누보드 관리자 권한.

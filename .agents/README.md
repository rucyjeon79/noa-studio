# Antigravity의 기존 N80 MCP 연결

이 폴더는 Antigravity가 NOA STUDIO의 기존 도구를 사용하는 클라이언트 설정이다.
새 MCP 서버, Gemini 모델 프록시, 독립 실행기 또는 자동 작업을 만들지 않는다.
N80 Engine은 작업 상태와 실행 권한을 소유하며 ChatGPT가 지휘·검수한다.

## 현재 상태 — 2026-11-09

- 기존 ChatGPT의 `noa_connection_status` 호출은 `ok`, `managementConnected`,
  `musicBriefReady` 모두 `true`였다.
- `serverUrl`은 기존 NOA STUDIO Assistant의 확인된 MCP 주소다.
- Antigravity 웹 계정에는 Remote Control과 실행기 연결 안내만 확인되었고,
  연결된 실행기 및 Remote Agents 프로젝트 화면은 확인되지 않았다.
- 별도의 비인증 HTTP 시험은 Cloudflare 403 / `browser_signature_banned`로
  차단되었다. OAuth 절차 전에 막힌 것이므로 Antigravity의 OAuth 호환성은
  아직 검증되지 않았다. 보안 차단을 우회하거나 서버 접근 범위를 변경하지 않는다.
- 따라서 설정은 `disabled: true`이며 **외부 연결 및 자동화는 미완료**다.
  설정 파일의 존재를 N80의 Gemini 연결 성공으로 기록하지 않는다.

## 실제 연결 순서

1. 사용 가능한 공식 Antigravity 실행기에서 동일 Google 계정으로 로그인한다.
   Remote Agents가 계정에 제공되면 GitHub의 `rucyjeon79/noa-studio`를 프로젝트
   리소스로 연결한다. 그렇지 않으면 Antigravity App/CLI가 실행되는 PC 또는
   서버가 필요하다. 저장소 파일을 추가하는 것만으로 GitHub 계정 연결은 되지 않는다.
2. 이 저장소를 작업 폴더로 사용하는 클라이언트는 `.agents/mcp_config.json`을
   읽는다. 원격 프로젝트는 실제 MCP 설정 로딩 여부를 별도로 확인한다.
3. 실행기에서 인증 시험을 시작할 때 해당 서버의 `disabled`를 `false`로 바꾸고
   MCP 관리 화면에서 연결한다. 공식 OAuth 로그인 창이 제공될 때 본인 계정으로
   인증한다. 인증을 제공하지 않거나 접근이 차단되면 다시 비활성화한다.
4. 도구 목록에서 위 세 도구가 발견되는지 확인한 후 `noa_connection_status`를
   호출한다. 이어 `noa_agent_tasks`와 대상 작업의 `noa_agent_read`로 실제 N80
   상태를 읽는다. 성공 응답을 관찰한 뒤에만 읽기 연결 성공으로 기록한다.
5. 전문 작업 실행·결과 반환·ChatGPT 검수·N80 저장은 별도의 실제 검증이 필요하다.
   읽기 연결만으로 Gem 이미지 생성, Flow 영상 생성, 게시 또는 상시 자동화를
   활성화하거나 기존 중지 작업을 재개하지 않는다.

`enabledTools`는 클라이언트의 도구 노출 목록이며 서버 권한 분리를 대신하지 않는다.
설정에는 읽기 도구 세 개만 포함한다. 쓰기·수락·게시 도구를 일괄 허용하지 않는다.
OAuth 토큰, 브라우저 쿠키, NOA 관리자 키, 사이트 우회 토큰을 저장소에 넣지 않는다.

개인 구독의 Antigravity CLI를 다른 에이전트의 모델 호출용 하위 프로세스로
감싸는 방식은 공식 지원 범위가 아니다. 이 설정은 반대로 공식 Antigravity
클라이언트가 기존 N80 도구를 사용하는 방향이다.

공식 문서:
- https://antigravity.google/docs/mcp
- https://antigravity.google/docs/remote-agents
- https://antigravity.google/docs/faq

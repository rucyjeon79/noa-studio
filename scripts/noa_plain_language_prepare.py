"""Reviewed display-copy substitutions; never rename protocol fields or stored keys."""
import json,subprocess
from pathlib import Path

COMMON = {
 'Suno 스타일 프롬프트':'Suno 음악 제작 지시문',
 '제미나이 썸네일 프롬프트':'제미나이 썸네일 제작 지시문',
 '캐릭터 고정 프롬프트':'캐릭터 모습 유지 지시문',
 '제작 프롬프트':'제작 지시문',
 '빈 필드 보완':'빈 항목 채우기',
 '데이터베이스 관리':'자료 저장소 관리',
 '데이터베이스':'자료 저장소',
 '전체 정보 JSON 파일 다운로드':'곡 정보 파일 저장',
 '추가 제작 자료 JSON':'추가 제작 자료',
 '추가 제작 자료의 JSON 형식을 확인해 주세요.':'추가 제작 자료의 입력 형식이 맞지 않습니다. 항목 이름과 내용을 확인해 주세요.',
 'JSON 내보내기':'작업 파일 저장',
 '2MB 이하의 작업 JSON을 선택해 주세요.':'이 화면에서 저장한 2MB 이하의 작업 파일을 선택해 주세요.',
 '가사 시간 정렬 JSON':'가사별 시작·종료 시간',
 'SQL 대기열을 확인하고 있습니다.':'처리 대기 목록을 확인하고 있습니다.',
 'SQL 분류와 연결 정보':'음악 분류와 연결 정보',
 'SQL 분류 연결을 확인해 주세요.':'음악 분류 연결을 확인해 주세요.',
 '음악 SQL 통합':'음악 자료 통합',
 '검증한 데이터 SQL 등록':'확인한 자료 저장',
 '검증 결과 SQL 등록':'확인한 자료 저장',
 'SQL 등록 완료':'자료 저장 완료',
 'SQL 통합 진행':'자료 통합 중',
 'SQL 등록·원본 체크섬·곡 수·수록 순서 검증 완료.':'자료 저장과 원본 파일·곡 수·수록 순서 확인을 마쳤습니다.',
 '원본·현재 DB·필드 충돌과 수록 순서를 검증하고 있습니다.':'원본과 저장된 자료의 차이, 겹치는 항목과 곡 순서를 확인하고 있습니다.',
 '추출·병합 검증 완료. 원본과 충돌을 보존하여 SQL에 등록할 수 있습니다.':'자료 정리와 비교를 마쳤습니다. 원본과 서로 다른 내용을 보존하면서 저장할 수 있습니다.',
 '새 SQL 판본 등록 완료 · 이전 판본과 원본 보존':'새 자료 저장 완료 · 이전 자료와 원본 보존',
 '이전 SQL 판본':'이전 저장 내용',
 '원본 메타데이터':'원본 상세 정보',
 '영상 메타데이터':'영상 상세 정보',
 '원문·메타데이터':'원문·상세 정보',
 '관리자 대화·곡별 생성 요청을 SQL에 보관하고':'관리자 대화와 곡별 생성 요청을 저장하고',
 'OpenAI API 요청 가능':'AI 생성 이용 가능',
 '운영 SQL 집계 확인 완료':'최신 집계 확인 완료',
 '운영 MySQL 연결 완료':'저장된 자료 연결 완료',
 '운영 DB에 저장했습니다.':'변경 내용을 저장했습니다.',
 'DB 연결·백업·실행 기록':'자료 저장 상태·백업·작업 기록',
 '제작 API·비용 한도·채널 소유자 인증':'AI 서비스 연결·비용 한도·채널 소유자 확인',
 'GitHub 실행 요청을 보내지 못했습니다. 닷홈 실행 토큰을 확인해 주세요.':'자동 제작을 시작하지 못했습니다. 관리자 연결 설정을 확인해 주세요.',
 'API 한도 또는 크레딧 잔액을 확인해 주세요.':'AI 서비스 이용 한도와 잔액을 확인해 주세요.',
 '닷홈 작업 실행 토큰':'자동 작업 연결 키',
 'GitHub에서 복사한 실행 토큰을 입력해 주세요.':'GitHub에서 발급받은 자동 작업 연결 키를 입력해 주세요.',
 '작업 스키마 주소':'작업 연결 안내 파일 주소',
 'Google 콜백:':'Google 로그인 후 돌아올 주소:',
 '카카오 콜백:':'카카오 로그인 후 돌아올 주소:',
 'Google에 등록할 리디렉션 주소':'Google에 등록할 로그인 후 돌아올 주소',
 '기존 Android APK 다운로드':'기존 Android 앱 설치 파일',
 'Android APK 다운로드':'Android 앱 설치 파일 받기',
 '기존에 APK로 설치한 분을 위한 다운로드입니다.':'기존에 설치 파일로 앱을 설치한 분을 위한 다운로드입니다.',
 '기존 테스트 APK(build 13)는 서명이 달라 정식 앱으로 덮어설치할 수 없습니다.':'기존 테스트 앱(13번 버전)은 정식 앱으로 바로 업데이트할 수 없습니다.',
 '안내 확인 · APK 다운로드':'안내 확인 · 앱 설치 파일 받기',
 '보안 토큰을 확인하세요. 페이지를 새로 열어 주세요.':'접속 확인 시간이 지났습니다. 페이지를 다시 열어 주세요.',
 '보안 토큰을 확인하세요.':'페이지를 새로고침한 뒤 다시 시도해 주세요.',
 '분류 조건 JSON':'분류 조건 · 정해진 입력 형식',
 '정책 JSON':'집계 기준 · 정해진 입력 형식',
 '운영 MySQL의 분류·연결·제작 기준을 관리합니다.':'저장된 음악의 분류·연결·제작 기준을 관리합니다.',
 '곡·ACT·플레이리스트별 전체 정보는 하나의 JSON 원본 문서에서 관리합니다.':'곡·ACT·플레이리스트별 정보는 하나로 모아 관리합니다.',
 '시청자 유지율 · 실제 API 결과':'시청자 유지율 · YouTube 제공 자료',
 '공식 API 유지율 응답을 표시했습니다.':'YouTube에서 제공한 시청자 유지율을 표시했습니다.',
 'API 재생 허용':'YouTube 재생 허용',
 '재생 허용은 API 응답이며 실제 재생 확인과 구분합니다.':'재생 허용은 YouTube의 설정 정보이며 실제 재생 확인 결과는 아닙니다.',
 '공식 API 요청을 완료하지 못했습니다. Google API 활성화·승인·할당량을 확인하세요. 수집된 이전 페이지는 보존됩니다.':'YouTube 정보를 가져오지 못했습니다. 채널 연결과 서비스 이용 한도를 확인해 주세요. 이전에 가져온 자료는 보존됩니다.',
 'OAuth 채널 연결 ':'Google 계정으로 연결한 채널 ',
 'OAuth 앱 설정 완료 · 채널 소유자 인증 필요':'Google 연결 설정 완료 · 채널 소유자 확인 필요',
 'OAuth 앱 설정 필요 · AI LAB의 서비스·채널 설정에 Client ID·Secret을 등록하세요.':'Google 연결 설정이 필요합니다. AI 제작실의 서비스·채널 설정에 연결 정보를 등록해 주세요.',
 'Analytics 연결 확인':'YouTube 성과 자료 연결 확인',
 'Analytics 실제 수집 전':'YouTube 성과 자료를 아직 가져오지 않았습니다',
 '노출·CTR 미제공':'노출 수·클릭률은 제공되지 않음',
 '기존 체크포인트를 보존했습니다.':'이전까지 진행한 내용을 보존했습니다.',
 '누락 URL 연결 보완':'빠진 영상 주소 연결',
 '자동 매칭 영상':'자동으로 연결한 영상',
 '자동 매칭 미완료':'연결 확인이 필요한 영상',
 '분류·매칭 근거 보기':'분류·연결 이유 보기',
 '자동분류·곡 매칭 중입니다.':'음악을 분류하고 곡을 연결하고 있습니다.',
 '자동분류와 곡 매칭을 완료했습니다.':'음악 분류와 곡 연결을 마쳤습니다.',
 '실행기 첫 연결 대기':'자동 처리 연결 대기',
 '실행기 확인 ':'자동 처리 연결 확인 ',
 '분석 작업을 등록했습니다. 실행기는 대기 작업을 순서대로 처리합니다.':'분석을 요청했습니다. 대기 순서대로 자동 처리합니다.',
 '원격 호스팅 앱 접근 승인':'온라인 앱 연결 승인',
 'FFmpeg 음원 최적화는 외부 AI API를 사용하지 않습니다.':'음원 최적화에는 외부 AI 서비스를 사용하지 않습니다.',
 '공식 API 응답으로 표시합니다.':'공식 제공 자료로 표시합니다.',
 '제공되지 않는 노출·CTR은 추정값으로 채우지 않습니다.':'제공되지 않는 노출 수와 클릭률은 추정하지 않습니다.',
 '여기는 제작 API와 운영 채널 연결입니다.':'여기에서 AI 제작 서비스와 운영 채널을 연결합니다.',
 '키와 토큰은 서버의 비공개 저장소에 암호화해 저장합니다.':'서비스 연결 정보는 다른 사람이 볼 수 없도록 암호화해 저장합니다.',
 'AI 기능을 요청하면 입력 내용과 답변·제작에 필요한 맥락이 API로 전달됩니다.':'AI 기능을 요청하면 입력 내용과 답변·제작에 필요한 자료가 AI 서비스에 전달됩니다.',
 '결제사 API를 통한 자동 카드 승인·정기 청구':'결제사와 직접 연결하는 자동 카드 결제·정기 결제',
 '처리기 복구·정합성 검증':'자동 처리 복구·자료 일치 확인',
 '503 응답 3회':'일시적인 연결 실패 3회',
 'HTML 응답 3회':'잘못된 응답 수신 3회',
 '청크 응답 유실':'나눠 보낸 파일의 수신 확인 누락',
 '완료 응답 유실':'완료 알림 누락',
 '장애 주입 해제':'오류 상황 테스트 해제',
}
SPECIAL = {
 'deploy/noa-youtube-admin.php':{'SQL 통합':'음악 자료 통합','Google Cloud의 YouTube Data API v3와 YouTube Analytics API를 활성화하고, 웹 애플리케이션 OAuth 클라이언트를 AI LAB 설정에 등록하세요.':'Google에서 영상·채널 통계 이용을 허용한 뒤 AI 제작실에서 채널을 연결해 주세요. Google 설정에 표시되는 서비스 이름은 YouTube Data API v3와 YouTube Analytics API입니다.'},
 'deploy/noa-ai-lab.php':{'fal API 키':'fal 서비스 연결 키','OpenAI API 키':'OpenAI 서비스 연결 키','Google OAuth Client ID':'Google 연결 ID (Client ID)','Google OAuth Client Secret':'Google 연결 비밀키 (Client Secret)','YouTube Data API와 YouTube Analytics API를 활성화한 웹 애플리케이션 인증을 사용합니다.':'Google 설정에서 영상 정보·채널 통계 서비스(YouTube Data API·YouTube Analytics API)를 켜 주세요.'},
 'deploy/noa-ai-lab.js':{'OpenAI API 키가 저장되지 않았습니다.':'OpenAI 서비스 연결 키가 저장되지 않았습니다.','활성화 전에 API 키와 비용 한도를 입력하세요.':'사용하기 전에 서비스 연결 키와 비용 한도를 입력해 주세요.',"api_key:'API 키'":"api_key:'서비스 연결 키'",'듀엣 보컬 구간 JSON:':'듀엣 가창 구간 입력 예시:',"+' 출력 토큰 · 예약 $'":"+' 응답 처리량 · 예상 비용 $'","+' 입력 / '":"+' 요청 처리량 / '","errors[e.message]||e.message":"errors[e.message]||(/[가-힣]/.test(e.message)?e.message:'요청을 완료하지 못했습니다. 입력 내용과 연결 상태를 확인한 뒤 다시 시도해 주세요.')","errors[error.message]||error.message":"errors[error.message]||(/[가-힣]/.test(error.message)?error.message:'요청을 완료하지 못했습니다. 입력 내용과 연결 상태를 확인한 뒤 다시 시도해 주세요.')","errors[job.error]||job.error":"errors[job.error]||'작업을 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.'"},
 'deploy/noa-browse-edit.js':{'OpenAI API 키':'OpenAI 서비스 연결 키','고급 자료':'추가 자료·파일 저장'},
 'deploy/noa-ainoa-admin.js':{"api_key:'API 키'":"api_key:'서비스 연결 키'",'OpenAI API · ':'OpenAI 연결 · ','현재 대화는 OpenAI API 설정을 사용합니다.':'현재 대화는 별도로 연결한 OpenAI 서비스를 사용합니다.'},
 'deploy/noa-ainoa.php':{'AI LAB에서 API 키와 프로젝트 권한을 확인해 주세요.':'AI 제작실에서 서비스 연결 키와 이용 권한을 확인해 주세요.'},
 'deploy/noa-muvy.js':{'Grok 연결 설정에서 API 키를 저장하고 생성을 켜 주세요.':'Grok 연결 설정에서 서비스 연결 키를 저장하고 생성을 켜 주세요.','xAI API 키를 입력해 주세요.':'xAI 서비스 연결 키를 입력해 주세요.','API 키 연결 필요':'AI 서비스 연결 필요',"errors[e.message]||e.message":"errors[e.message]||(/[가-힣]/.test(e.message)?e.message:'작업을 완료하지 못했습니다. 입력 내용과 연결 상태를 확인해 주세요.')"},
 'deploy/noa-muvy-panel.php':{'xAI API 키':'xAI 서비스 연결 키'},
 'deploy/noa-record-form.js':{'트랙리스트 · 타임스탬프':'곡 목록 · 재생 시작 시간'},
 'deploy/noa-app/popularity/index.php':{'JUKEBOX 담당자의 서버 전송 확인·이벤트 연결 검증 후 playbackIntegrationEnabled를 활성화합니다. 연결 전 재생수는 미수집 상태입니다.':'음악 재생 기록이 정상적으로 전달되는지 확인한 뒤 재생수 집계를 켭니다. 연결 전에는 재생수가 수집되지 않습니다.'},
 'deploy/noa-payment-settings.php':{'API 개별 연동 클라이언트 키':'결제창 연결 키 (클라이언트 키)','API 개별 연동 시크릿 키':'결제 승인 비밀키 (시크릿 키)','웹훅 서명 검증용 보안 키':'결제 알림 확인용 보안 키','웹훅을 다음 주소로 등록하세요.':'결제 완료 알림을 받을 주소로 다음 주소를 등록해 주세요.','API 개별 연동 키와 보안 키':'결제 서비스 연결 키와 알림 확인용 보안 키','API 개별 연동 키·상점 ID·웹훅 보안 키':'결제 연결 키·상점 번호·알림 확인용 보안 키','API 키 메뉴의 보안 키':'연결 키 설정 메뉴의 보안 키'},
 'deploy/noa-app/database/index.php':{'DB 연결 상태':'자료 저장소 연결 상태','읽기 전용 SQL':'조회 전용 · 자료 변경 없음','SQL 조회 콘솔':'직접 조회 · 조회 명령 입력','SQL 백업 생성':'자료 백업 파일 만들기','전체 DB':'전체 자료','테이블 목록':'자료 목록','검색 컬럼':'검색 항목','포함된 문자열':'포함된 글자','행 수와 용량은 MySQL 메타데이터의 추정치입니다. 테이블을 선택하면 구조를 확인합니다.':'자료 건수와 용량은 저장소에서 제공한 추정치입니다. 목록을 선택하면 저장 항목을 확인할 수 있습니다.','SHA-256 일치':'원본과 파일 내용 일치','영향 테이블·백업 SHA-256·복구 계획을 최고관리자가 별도 승인':'영향받는 자료·백업 파일 일치 여부·복구 계획을 최고관리자가 별도 승인','이 화면에서는 운영 DB 복원을 실행하지 않습니다.':'이 화면에서는 실제 자료 복원을 실행하지 않습니다.','DB 작업을 완료하지 못했습니다.':'자료 조회를 완료하지 못했습니다.','DB 관리 작업을 완료하지 못했습니다.':'자료 관리 작업을 완료하지 못했습니다.','SQL을 입력하세요.':'자료를 찾을 조회 명령을 입력해 주세요.','CSV 내보내기':'표 파일 저장 (CSV)','다운로드할 때 무결성을 다시 확인합니다.':'내려받을 때 파일이 손상되지 않았는지 다시 확인합니다.'},
 'deploy/noa-app/database/ui.js':{'전체 DB':'전체 자료','DB 연결 상태 확인 완료':'자료 저장소 연결 상태 확인 완료',"'DB 연결'":"'자료 저장소 연결'",'MySQL 버전':'저장소 프로그램 버전','SQL 조회 완료':'자료 조회 완료','SHA-256 무결성 확인 완료':'백업 파일 손상 여부 확인 완료','백업 생성 및 SHA-256 확인 완료':'백업 저장 및 파일 확인 완료','무결성 확인':'파일 손상 여부 확인','컬럼 구조':'저장 항목','테이블 목록 조회 완료':'자료 목록 조회 완료','동일한 조회 제한으로 CSV를 생성합니다.':'현재 조회 조건으로 표 파일을 저장합니다.'},
}
SPECIAL['deploy/noa-app/database/index.php'].update({
 'InnoDB는 일관된 스냅샷으로 보관합니다. MyISAM이 포함되면 백업 동안 조회 잠금을 사용하여 해당 테이블의 쓰기를 최대 40초 대기시킵니다. 전체 백업은 뷰·트리거·루틴·이벤트가 없는 DB에서 지원합니다. 지원하지 않는 객체가 있으면 불완전한 백업을 만들지 않습니다. 안전 상한: 256MB / 40초.':'백업 시점의 자료가 서로 맞도록 보관합니다. 일부 저장 방식에서는 백업 중 자료 변경이 최대 40초 동안 대기할 수 있습니다. 자동 처리 규칙이나 가상 자료 목록 등 특수 설정이 있으면 전체 백업을 지원하지 않으며, 불완전한 백업은 만들지 않습니다. 최대 크기 256MB, 최대 처리 시간 40초입니다.',
 '단일 테이블 SELECT · WHERE(AND/OR/LIKE/IS NULL) · GROUP BY · ORDER BY · COUNT/SUM/AVG/MIN/MAX. 최대 1,000행, 3초, 결과 4MB. 주석·세미콜론·JOIN·하위 쿼리는 지원하지 않습니다.':'저장된 자료 한 종류를 조회하는 관리자용 기능입니다. 자료를 수정하거나 삭제하지 않습니다. 최대 1,000건, 3초, 결과 4MB까지 조회할 수 있습니다. 지원 명령: SELECT, WHERE(AND/OR/LIKE/IS NULL), GROUP BY, ORDER BY, COUNT/SUM/AVG/MIN/MAX. 주석, 세미콜론, 여러 자료 합치기(JOIN), 중첩 조회는 지원하지 않습니다.'})
SPECIAL['deploy/noa-youtube.js']={"messages[d.error]||d.error":"messages[d.error]||'YouTube 정보를 확인하지 못했습니다. 채널 연결을 확인한 뒤 다시 시도해 주세요.'"}
SPECIAL['deploy/noa-subscription.js']={"'요청을 완료하지 못했습니다. ('+(d.error||r.status)+')'":"'요청을 완료하지 못했습니다. 새로고침 후 구독 내역을 확인해 주세요.'"}
SPECIAL['deploy/noa-creator.js']={"'요청을 완료하지 못했습니다. ('+(data.error||response.status)+')'":"'요청을 완료하지 못했습니다. 입력 내용과 연결 상태를 확인해 주세요.'"}
SPECIAL['deploy/noa-app/taxonomy/ui.js']={' · revision ':' · 수정 이력 ',"names[reason]||reason":"names[reason]||'분류와 곡 연결을 확인해 주세요.'","throw Error(d.error||'요청 실패')":"throw Error('요청을 완료하지 못했습니다. 입력 형식과 연결 상태를 확인해 주세요.')"}

def main():
 rows=[]
 for p in sorted(Path('deploy').rglob('*')):
  if p.suffix not in ('.php','.js') or 'noastudio/' in str(p):continue
  original=subprocess.check_output(['git','show','HEAD:'+str(p)],text=True);content=original;changes=[]
  for old,new in {**COMMON,**SPECIAL.get(str(p),{})}.items():
   if old in content:
    changes.append({'old':old,'new':new,'count':content.count(old)});content=content.replace(old,new)
  if content!=original:
   p.write_text(content);rows.append({'source':str(p),'remote':str(p)[7:],'changes':changes})
 Path('scripts/noa_plain_language_manifest.json').write_text(json.dumps({'files':rows,'policy':'Display copy only. Protocol names, URLs, user content and database values are preserved.'},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'files':len(rows),'phrases':sum(len(x['changes']) for x in rows),'occurrences':sum(c['count'] for x in rows for c in x['changes'])}))
if __name__=='__main__':main()

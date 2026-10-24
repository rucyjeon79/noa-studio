"""Register the existing twelve-area task journal; never mark the parent complete."""
import base64, hashlib, hmac, json, os, secrets, stat, time, urllib.request
from pathlib import Path
import paramiko
from n80_live_observer import NoRedirect
BASE='/hosting/noastudio/noa-ai-lab'
DIRECTORY=BASE+'/n80-workstate'
URL='https://noastudio.ai.kr/noa-app/engine/work-state-report.php'
def compact(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def request(key,value):
 raw=compact(value);ts=str(int(time.time()));nonce=secrets.token_hex(16)
 signature=hmac.new(key,('N80-WORKSTATE-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
 req=urllib.request.Request(URL,data=raw,headers={'Content-Type':'application/json','X-N80-Timestamp':ts,'X-N80-Nonce':nonce,'X-N80-Signature':signature},method='POST')
 with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as response:
  body=response.read(1048577);sig=response.headers.get('X-N80-Signature','')
 if len(body)>1048576:raise RuntimeError('workstate_response_too_large')
 expected=hmac.new(key,('N80-WORKSTATE-RESPONSE-1\n'+nonce+'\n'+hashlib.sha256(body).hexdigest()).encode(),hashlib.sha256).hexdigest()
 if not hmac.compare_digest(sig,expected):raise RuntimeError('workstate_response_signature_mismatch')
 result=json.loads(body)
 if result.get('ok') is not True or result.get('nonce')!=nonce or result.get('databaseWrites')!=0 or result.get('workCompletedEventEmitted')is not False:raise RuntimeError('workstate_response_invalid')
 return result['result']
def main():
 transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  transport.get_security_options().key_types=('ssh-ed25519',);transport.start_client(timeout=25)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
  with paramiko.SFTPClient.from_transport(transport)as sftp:
   sftp.get_channel().settimeout(30)
   if sftp.normalize(BASE)!=BASE or not stat.S_ISDIR(sftp.lstat(BASE).st_mode):raise RuntimeError('unsafe_private_parent')
   try:info=sftp.lstat(DIRECTORY)
   except FileNotFoundError:sftp.mkdir(DIRECTORY,0o700);info=sftp.lstat(DIRECTORY)
   if sftp.normalize(DIRECTORY)!=DIRECTORY or not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode)!=0o700:raise RuntimeError('unsafe_workstate_directory')
   for name in ['work-state.php','work-state-report.php','event-contract.php','app-observe.php']:
    with sftp.open('/hosting/noastudio/html/noa-app/engine/'+name,'rb')as source:actual=source.read()
    if actual!=Path('deploy/noa-app/engine/'+name).read_bytes():raise RuntimeError('workstate_source_not_deployed')
   with sftp.open(BASE+'/worker.key','rb')as source:key=source.read(129).strip()
   if len(key)!=64:raise RuntimeError('invalid_worker_key')
   before=request(key,{'action':'read'})
   state=before['state'];directive='integration-12-areas-20261024-final'
   if not any(x['id']==directive for x in state['instructions']):
    notes={
    'P0-01':('in_progress','운영 사이트맵과 관리자 링크 반영; 권한별 최종 검증 진행'),
    'P0-02':('needs_review','기존 HOME 유지 및 인기 지표 표시 보완; 전체 콘텐츠 검수 남음'),
    'P0-03':('in_progress','602곡 순서와 상세 원문 보존; 실제 재생 집계 활성화 검증 진행'),
    'P0-04':('needs_review','일반 영상과 공식 MV 분리; 제공자 재생 인증 장벽 및 실제 재생 확인 필요'),
    'P0-05':('needs_review','공식 EP 30개와 ACT 3개 분리; 제공자 재생 확인 필요'),
    'P0-06':('needs_review','MP3 및 큐 보존; 실제 모바일 기기 잠금 재생 검증 남음'),
    'P0-07':('in_progress','기존 개인 목록 보존 및 데스크톱 드래그 추가; 운영 회원 저장 검증 필요'),
    'P0-08':('in_progress','확정 디자인 재사용; Dark와 Ivory 및 지정 화면 폭 검수 진행'),
    'P0-09':('in_progress','YouTube 초기 전체 상세 제거 전후 성능 측정 진행'),
    'P0-10':('in_progress','기존 엔진 및 단일 상위 작업 승계; MUSIC 실제 ACK와 재요청 검증 진행'),
    'P0-11':('in_progress','기존 자동배포 재사용; 독립 품질 검사 및 완료 증거 수집 진행'),
    'P0-12':('needs_review','기존 SQL Drive 이전과 회수량 증거 유지; 자동 Drive 인증 Secret 누락')}
    value={'action':'revise','request':{'requestId':directive,'expectedRevision':state['revision'],'changes':[{'areaId':k,'status':v[0],'note':v[1],'evidenceIds':[]}for k,v in notes.items()],'appendInstructions':[{'id':directive,'text':'기존 작업을 이어서 12개 영역을 정상화하고 운영 검증 후에만 완료한다. 새 지시는 기존 작업을 삭제하지 않고 대기열에 추가한다.','areaIds':list(notes)}]}}
    first=request(key,value);again=request(key,value)
    if first.get('readbackVerified')is not True or again.get('effect')!='work_state_already_recorded' or first['state']!=again['state']:raise RuntimeError('workstate_replay_changed_state')
   directive4='category-four-level-20261025'
   current=request(key,{'action':'read'})['state']
   if not any(x['id']==directive4 for x in current['instructions']):
    value4={'action':'revise','request':{'requestId':directive4,'expectedRevision':current['revision'],
     'changes':[{'areaId':'P0-03','status':'in_progress','note':'카테고리 → 장르 → ACT → 곡 4단계와 EP 오름차순 운영 검증 완료. 회원 저장 등 잔여 MUSIC 검증은 미완료 유지.','evidenceIds':[]},
                {'areaId':'P0-04','status':'needs_review','note':'카테고리 → 장르 → ACT → 영상 4단계 운영 검증 완료. YouTube 제공자 재생 검증은 별도 미완료 유지.','evidenceIds':[]}],
     'appendInstructions':[{'id':directive4,'text':'YouTube와 MUSIC에서 4개 최상위 카테고리 아래 해당 장르, 장르 아래 ACT 플레이리스트, 선택 ACT 아래 수록곡을 펼친다. ACT 미소속 곡은 ACT 목록 하단에 연속 표시하며 EP 번호는 오름차순이다. 기존 12개 영역과 미완료 작업은 유지한다.','areaIds':['P0-03','P0-04']}]}}
    first4=request(key,value4);again4=request(key,value4)
    if first4.get('readbackVerified')is not True or again4.get('effect')!='work_state_already_recorded' or first4['state']!=again4['state']:raise RuntimeError('four_level_workstate_replay_changed_state')
   after=request(key,{'action':'read'});summary=after['summary']
   if summary.get('allAreasComplete')is not False or len(summary['areas'])!=12 or not all(any(x['id']==d for x in summary['instructionQueue']) for d in [directive,directive4]):raise RuntimeError('workstate_incomplete_parent_contract_failed')
   out={'parentTaskId':summary['parentTaskId'],'revision':summary['revision'],'counts':summary['counts'],'allAreasComplete':False,'readbackVerified':True,'databaseWrites':0,'workCompletedEventEmitted':False,'eventSha256':after.get('eventSha256'),'instructionIds':[directive,directive4]}
   path=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'n80-workstate-result.json';path.write_text(json.dumps(out));print('N80_WORKSTATE_VERIFIED '+json.dumps(out))
 finally:transport.close()
if __name__=='__main__':main()

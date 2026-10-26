"""Signed metadata-only SQL/queue audit and additive N80 instruction registration."""
import collections, hashlib, hmac, json, os, secrets, time, urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from noa_p0_progress import initial_changes
from n80_live_observer import NoRedirect
from n80_workstate_sync import request as work_request, compact
from noa_jukebox_recovery import signed_service

DIRECTIVE=Path('docs/operations/requests/NOA_20261026_P0_ADDITIONS.md')
TASKS=[
 ('01','JUKEBOX 업로드·FIFO·복원·FFmpeg 전수 점검',['P0-06','P0-09','P0-12']),
 ('02','AI 생성 버튼·API·검토 후 반영·중복 과금 방지',['P0-03','P0-04','P0-08']),
 ('03','곡 원본·SQL·카탈로그·Drive 누락 전수 조사 및 검증 복원',['P0-03','P0-04','P0-12']),
 ('04','MySQL 기준 저장소·JSON 역할·revision 충돌 보호',['P0-03','P0-10','P0-12']),
 ('05','확정 디자인 토큰·모바일·2줄 JUKEBOX·배포 차단 검사',['P0-08','P0-11']),
 ('06','AI 서비스 설정·모델·사용량·권한·포인트·비밀키 보호',['P0-07','P0-10','P0-12']),
 ('07','N80 지시 원문·누적 작업·단계·활동·오류·증거·재개',['P0-10','P0-11'])]
def chunks(text,limit=1800):
 result=[];part=''
 for char in text:
  if len((part+char).encode())>limit:result.append(part);part=''
  part+=char
 if part:result.append(part)
 assert ''.join(result)==text
 return result
def inventory(key):
 raw=compact({'action':'inventory'});ts=str(int(time.time()));nonce=secrets.token_hex(16)
 sig=hmac.new(key,('NOA-P0-AUDIT-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
 req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/p0-audit.php',data=raw,headers={'Content-Type':'application/json','X-N80-Timestamp':ts,'X-N80-Nonce':nonce,'X-N80-Signature':sig})
 with urllib.request.build_opener(NoRedirect()).open(req,timeout=90)as r:body=r.read(4194305);signature=r.headers.get('X-N80-Signature','')
 if len(body)>4194304:raise RuntimeError('inventory_too_large')
 expected=hmac.new(key,('NOA-P0-AUDIT-RESPONSE-1\n'+nonce+'\n'+hashlib.sha256(body).hexdigest()).encode(),hashlib.sha256).hexdigest()
 if not hmac.compare_digest(signature,expected):raise RuntimeError('inventory_signature_mismatch')
 value=json.loads(body)
 if value.get('ok')is not True or value.get('nonce')!=nonce or value.get('databaseWrites')!=0:raise RuntimeError('invalid_inventory')
 return value['result']
def main():
 out=Path(os.environ.get('NOA_P0_AUDIT_OUTPUT','p0-audit-proof'));out.mkdir(parents=True,exist_ok=True);t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(30)
   with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(129).strip()
 finally:t.close()
 if len(key)!=64:raise RuntimeError('invalid_worker_key')
 source=DIRECTIVE.read_text();sha=hashlib.sha256(source.encode()).hexdigest();before=work_request(key,{'action':'read'});state=before['state']
 entries=[{'id':'NOA-20261026-P0-'+n,'text':label+'; 원문 SHA256 '+sha+'; 완료는 운영 증거 확인 후 기록.','areaIds':areas}for n,label,areas in TASKS]
 entries += [{'id':'NOA-20261026-P0-ORIGINAL-'+str(i+1).zfill(2),'text':part,'areaIds':['P0-10']}for i,part in enumerate(chunks(source))]
 existing={x['id']:x for x in state['instructions']}
 for entry in entries:
  if entry['id']in existing and any(existing[entry['id']][k]!=entry[k]for k in ['text','areaIds']):raise RuntimeError('directive_identity_conflict')
 pending=[x for x in entries if x['id']not in existing]
 if pending:
  request={'action':'revise','request':{'requestId':'NOA-20261026-P0-APPEND-'+sha[:16],'expectedRevision':state['revision'],'changes':[],'appendInstructions':pending}}
  first=work_request(key,request);again=work_request(key,request)
  if first.get('readbackVerified')is not True or again.get('effect')!='work_state_already_recorded':raise RuntimeError('directive_append_not_verified')
 after=work_request(key,{'action':'read'});new=after['state'];recorded={x['id']:x for x in new['instructions']}
 if new['areas']!=state['areas'] or any(recorded.get(i)!=x for i,x in existing.items()):raise RuntimeError('existing_work_changed')
 if ''.join(recorded[x['id']]['text']for x in entries if '-ORIGINAL-'in x['id'])!=source:raise RuntimeError('directive_original_mismatch')
 receipt={'commit':os.environ['GITHUB_SHA'],'parentTaskId':new['parentTaskId'],'revision':new['revision'],'addedTasks':[x['id']for x in entries[:7]],'originalSha256':sha,'originalBytes':len(source.encode()),'previousAreasPreserved':True,'previousInstructionsPreserved':True,'allAreasComplete':after['summary']['allAreasComplete']}
 (out/'n80-additions.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print('N80_P0_ADDITIONS',json.dumps(receipt,ensure_ascii=False),flush=True)
 result=inventory(key);(out/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('NOA_P0_INVENTORY',json.dumps({k:v for k,v in result.items()if k not in ['rows','archivedSources','archiveComparison','sourceRetention']},ensure_ascii=False),flush=True)
 print('NOA_P0_SOURCE_AUDIT',json.dumps({'archiveMatchedDocuments':result['archiveComparison']['matchedDocuments'],'missingFields':len(result['archiveComparison']['sourceFieldMissing']),'differentFields':len(result['archiveComparison']['sourceFieldDifferent']),'sourceRetention':{k:v for k,v in result['sourceRetention'].items()if k!='rows'}},ensure_ascii=False),flush=True)
 # Existing fixed signed recovery read operations, with no audio or queue mutation.
 call=signed_service(key.decode());queue=call('queue_snapshot');health=call('runtime_health');integrity=call('integrity_snapshot')
 q={'checkedAt':health['checked_at'],'statuses':dict(collections.Counter(r['status']for r in queue['rows'])),'queued':health['queued'],'active':health['active'],'worker':health['worker'],'integrity':integrity,'jobs':queue['rows']}
 stages=[
 ('01','in_progress','원본 보존 및 상태 복원 운영 검증','FIFO 전수 조회: 대기 '+str(health['queued'])+'건, 처리 중 '+str(health['active'])+'건',''),
 ('02','in_progress','버튼 진행·오류·검토·중복 방지 회귀 검증','기존 생성 엔드포인트와 UI 오류 경로 확인',''),
 ('03','in_progress','원본·화면·Drive 대조 및 누락 분류','SQL 곡·플레이리스트 '+str(result['documents'])+'개 읽기 전용 감사',''),
 ('04','in_progress','편집 경로별 별칭 충돌·revision 검증','운영 문서·카탈로그·보관 원본 테이블 InnoDB 확인',''),
 ('05','in_progress','모바일 디자인과 배포 전 차단 검사','기존 공통 토큰 및 2줄 JUKEBOX 구조 확인',''),
 ('06','needs_review' if not result['aiSettings']['keyConfigured'] else 'in_progress','AI 서비스 준비 상태 확인','서버 설정을 비밀값 없이 조회','OpenAI API 키·사용 한도 미설정' if not result['aiSettings']['keyConfigured'] else ''),
 ('07','in_progress','작업별 단계·활동·오류·증거 기록 검증','기존 12개 영역과 추가 지시 원문 보존 확인','')]
 snapshot=work_request(key,{'action':'read'})['state'];rid='NOA-20261026-P0-STAGES-'+os.environ['GITHUB_SHA'][:12]
 changes=initial_changes(snapshot,stages)
 if changes and rid not in snapshot['requestReceipts']:
  req={'action':'revise','request':{'requestId':rid,'expectedRevision':snapshot['revision'],'changes':[],'appendInstructions':[],'taskChanges':changes}}
  first=work_request(key,req);again=work_request(key,req)
  if first.get('readbackVerified')is not True or again.get('effect')!='work_state_already_recorded':raise RuntimeError('task_stage_readback_failed')
 final=work_request(key,{'action':'read'});unchanged={x['id']:x for x in snapshot['instructions'] if x['id']not in {c['id']for c in changes}};latest={x['id']:x for x in final['state']['instructions']}
 if any(latest.get(k)!=v for k,v in unchanged.items()):raise RuntimeError('existing_task_progress_changed')
 tasks=[x for x in final['summary']['instructionQueue']if x['id']in receipt['addedTasks']]
 if len(tasks)!=7 or any('lastActivityAt'not in x for x in tasks):raise RuntimeError('task_stage_missing')
 (out/'n80-tasks.json').write_text(json.dumps({'revision':final['state']['revision'],'tasks':tasks,'executionControl':final['summary']['executionControl']},ensure_ascii=False,indent=2));print('N80_P0_TASK_STAGES',json.dumps({'revision':final['state']['revision'],'tasks':tasks,'executionControl':final['summary']['executionControl']},ensure_ascii=False),flush=True)
 (out/'queue.json').write_text(json.dumps(q,ensure_ascii=False,indent=2));print('NOA_P0_QUEUE',json.dumps({k:v for k,v in q.items()if k!='jobs'},ensure_ascii=False),flush=True)
if __name__=='__main__':main()

"""Bounded P0 release evidence; never claim provider activation or all-area completion."""
import json, os, sys
from pathlib import Path

def build():
    root=Path('ainoa-proof'); cases=[]
    generation=json.loads((root/'live/generation-report.json').read_text())
    assert len(generation)==4
    for row in generation:
        assert all(row[k] is True for k in ['unconfiguredVisible','doubleClickOneRequest','previewBeforeApply','noAutomaticSave','typingPreserved','stableRetryIdentity','htmlErrorVisible','explicitSave','touchTargets']) and row['overflow'] is False
        cases.append({'name':'deployed_editor_isolated_api_'+str(row['width']),'ok':True})
    admin=json.loads((root/'live/admin-report.json').read_text());assert len(admin)==6
    for row in admin:
        assert all(row[k] is True for k in ['guestHidden','highestAdminDialog','storedConversation','selectedSongContext','networkRetrySameIdentity','noDuplicateTask','draftNotSaved','unconfiguredQueuePreserved','subscriptionNotFalselyConnected','safeTextRendering','touchTargets','noOverflow'])
        cases.append({'name':'deployed_admin_dialog_isolated_api_'+str(row['width'])+'_'+row['theme'],'ok':True})
    guests=json.loads((root/'live/report.json').read_text());assert len(guests)==10
    for row in guests:
        assert row['search'] and row['roleGate'] and not row['overflow'] and not row['consoleErrors']
        cases.append({'name':'operating_guest_'+row['theme']+'_'+str(row['width']),'ok':True})
    audit=json.loads((root/'postdeploy-audit/inventory.json').read_text())
    assert audit['databaseWrites']==0 and audit['documents']>=660 and audit['archiveComparison']['matchedDocuments']>=653
    assert not audit['archiveComparison']['sourceFieldMissing']
    cases.append({'name':'operating_sql_source_field_preservation','ok':True})
    queue=json.loads((root/'postdeploy-audit/queue.json').read_text())
    cases.append({'name':'operating_queue_snapshot_read','ok':isinstance(queue['queued'],int) and isinstance(queue['active'],int)})
    tasks=json.loads((root/'postdeploy-audit/n80-tasks.json').read_text())
    assert len(tasks['tasks'])==7 and tasks['executionControl']=='project_journal_only'
    cases.append({'name':'additive_n80_task_readback','ok':True})
    order=root/'category-order-migration.json'
    if order.is_file():
        migrated=json.loads(order.read_text());assert migrated['source']=='mysql' and migrated['legacyUnchanged'] and migrated['publicReadbackUnchanged'] and migrated['unrelatedDocumentsUnchanged']
        cases.append({'name':'category_order_SQL_migration_preserves_original','ok':True})
    report={'ok':True,'cases':cases,'scope':'Deployed assets and operating read-only data; generation responses are isolated fixtures. No real AI provider call, production song edit or point debit.', 'providerConfigured':audit['aiSettings']['keyConfigured'],'allOriginalAreasComplete':False,'historicalInputRestorationVerified':False}
    (root/'verified.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('NOA_P0_RELEASE_EVIDENCE_READY',len(cases))

def record():
    import paramiko
    import n80_report_evidence as ev
    from n80_completion_pipeline import api,download_artifact
    from noa_full_inventory import connect
    from n80_workstate_sync import request
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());trigger=event.get('workflow_run',{})
    assert event['repository']['full_name']==ev.REPO and trigger['head_repository']['full_name']==ev.REPO and trigger['head_branch']=='main'
    run=api('/actions/runs/'+str(trigger['id']));assert run['path']=='.github/workflows/noa-ainoa.yml' and run['event'] in ['push','workflow_dispatch']
    commit=run['head_sha'];verified=ev.verified_run(run,run['id'],commit)
    artifacts=api('/actions/runs/'+str(run['id'])+'/artifacts')['artifacts']
    matches=[a for a in artifacts if a['name']=='noa-ainoa-live-'+str(run['id'])];assert len(matches)==1
    out=Path('p0-evidence-proof');out.mkdir(exist_ok=True)
    archive=download_artifact(matches[0]['id'],out/'release.zip')
    ver=verified|ev.verified_artifact(matches[0],run['id'],commit,archive,'verified.json')
    source=['noa-ainoa-admin.js','noa-bridge/ainoa-automation.php','noa-app/engine/ai-automation.php','noa-bridge/lab-worker.php','noa-browse-edit.js','noa-ainoa.php','noa-bridge/ainoa-generation.php','noa-bridge/package-record.php','noa-app/engine/work-state.php','noa-work-status.php','noa-category-order.php','noa-bridge/category-order-store.php']
    t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t)as s:
            s.get_channel().settimeout(30)
            files=ev.source_readback(s,'.',commit,source)
            http=ev.http_evidence([{'url':ev.ORIGIN+p,'expectedStatus':status}for p,status in [('/',200),('/noa-category-order.php',200),('/noa-work-status.php',403)]])
            proof=ev.build_event('deploy.verified','admin','integration-finish-20261024:p0-additions','Work_P0_20261026',commit,verified,ver,files,http)
            with s.open(ev.KEY_PATH,'rb')as f:key=f.read(129).strip()
            receipt=ev.publish(proof,key)
    finally:t.close()
    snapshot=request(key,{'action':'read'})['state'];rid='NOA-20261026-P0-EVIDENCE-'+commit[:12]
    if rid not in snapshot['requestReceipts']:
        notes={
          '01':('needs_review','신고 곡 MP3 정상 · 원본 자동 정리 차단','운영 대기열·완료 파일 해시 및 복원 회귀 확인','과거 업로드 원본의 별도 백업 복원은 미검증'),
          '02':('needs_review','운영 버튼 수정 반영 · 실제 AI 호출 설정 대기','진행·오류·초안 검토·중복 방지 검사 통과','API 키·활성화·사용 한도 설정 필요'),
          '03':('needs_review','653개 원본 연결 문서 대조 · 누락 필드 0건','Drive SQL과 보관 원본 731개 해시 일치','J-POP ACT 1 보컬 차이 1건 검토; 원본 없는 번역·프롬프트는 생성하지 않음'),
          '04':('in_progress','곡 정보와 카테고리 정렬 SQL 기준 운영 반영','원본 정렬 보존·revision 충돌 차단·SQL 영수증 회귀 통과','기존 12개 영역 전체 저장 경로의 최종 검수는 별도 유지'),
          '05':('in_progress','모바일 디자인 필수 검사 통과 후 배포','360·390·430·1280px 2줄·터치·겹침·화면 비교 통과','전체 페이지 디자인 검수 및 실제 기기 검증은 별도 유지'),
          '06':('needs_review','설정 상태·연결 확인·사용량 기록 반영','권한·중복 과금·공유 사용 한도 회귀 통과','API 키·사용 한도·유료 대화 단가 미설정; 실제 과금 검증 안 됨'),
          '07':('in_progress','작업별 증거 연결 및 운영 읽기 검증','지시 원문·12개 영역·단계·활동·오류·재시작 복원 검증','상위 전체 작업 완료로 처리하지 않음')}
        changes=[{'id':'NOA-20261026-P0-'+n,'status':status,'currentStage':current,'lastSuccessfulStage':success,'error':error,'evidenceIds':[receipt['eventId']]}for n,(status,current,success,error)in notes.items()]
        changes.append({'id':'NOA-20261026-AI-AUTOMATION','status':'needs_review','currentStage':'최고관리자 대화창·N80 SQL 초안 자동화 운영 반영','lastSuccessfulStage':'네이티브 SQL·권한·모바일 UI·서명된 실행기 연결 검증','error':'실제 모델 응답은 API 설정 필요. ChatGPT 구독 연동은 원격 앱 접근 승인과 별도 연동 필요.','evidenceIds':[receipt['eventId']]})
        value={'action':'revise','request':{'requestId':rid,'expectedRevision':snapshot['revision'],'changes':[],'appendInstructions':[{'id':'NOA-20261026-AI-AUTOMATION','text':'n80 엔진에 자동화 구현하고. 사이트 떠다니는 AInoa에 최고관리자가 버튼 누르면 챗지피티와 연결된 대화창 연결. AI생성 기능구현 시작','areaIds':['P0-10','P0-03','P0-04','P0-08']}],'taskChanges':changes}}
        result=request(key,value);assert result['readbackVerified'];assert request(key,value)['effect']=='work_state_already_recorded'
    final=request(key,{'action':'read'});assert not final['summary']['allAreasComplete']
    assert all(any(e['eventId']==receipt['eventId']for e in x.get('evidence',[]))for x in final['state']['instructions']if x['id'] in ['NOA-20261026-P0-0'+str(i)for i in range(1,8)])
    (out/'receipt.json').write_text(json.dumps({'ok':True,'commit':commit,'run':run['id'],'receipt':receipt,'revision':final['state']['revision'],'allAreasComplete':False},indent=2))
    print('N80_P0_EVIDENCE_LINKED',json.dumps({'eventId':receipt['eventId'],'revision':final['state']['revision'],'allAreasComplete':False}))

if __name__=='__main__':
    if sys.argv[1:] == ['build']:build()
    elif sys.argv[1:] == ['record']:record()
    else:raise SystemExit('expected build or record')

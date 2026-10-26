"""Verify release artifacts and persist additive instructions; never complete the twelve-area parent."""
import json,os,sys
from pathlib import Path

def build():
    root=Path('membership-proof');live=json.loads((root/'live/report.json').read_text());verify=json.loads((root/'verify.json').read_text());activation=json.loads((root/'activate.json').read_text());maintain=json.loads((root/'maintain.json').read_text());deployment=json.loads((root/'deployment.json').read_text())
    assert len(live)==6 and all(r['noOverflow'] and r['socialOnlyServerGuards'] and r['legacyLoginPreserved'] for r in live)
    native=verify['nativeVerification'];assert verify['ok'] and native['temporaryAccountRemoved'] and len(native['passed'])>=9
    assert activation['ok'] and (activation.get('activated') or activation.get('alreadyActive')) and maintain['ok']
    assert deployment['commit']==os.environ['GITHUB_SHA']
    cases=[{'name':x,'ok':True}for x in native['passed']]+[{'name':'live_guest_'+r['theme']+'_'+str(r['width']),'ok':True}for r in live]
    (root/'verified.json').write_text(json.dumps({'ok':True,'cases':cases,'sourceCommit':deployment['commit'],'socialSettings':verify['social'],'externalOAuthCompleted':False,'realAIGenerationCompleted':False,'cashPaymentConfigured':False,'allAreasComplete':False},ensure_ascii=False,indent=2))
    print('MEMBERSHIP_RELEASE_EVIDENCE_READY',len(cases))

def record():
    import paramiko
    import n80_report_evidence as ev
    from n80_completion_pipeline import api,download_artifact
    from n80_workstate_sync import request
    from noa_full_inventory import connect
    from noa_p0_inventory import chunks
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());trigger=event['workflow_run']
    assert event['repository']['full_name']==ev.REPO and trigger['head_repository']['full_name']==ev.REPO and trigger['head_branch']=='main'
    run=api('/actions/runs/'+str(trigger['id']));assert run['path']=='.github/workflows/noa-membership-policy.yml'
    commit=run['head_sha'];verified=ev.verified_run(run,run['id'],commit)
    items=api('/actions/runs/'+str(run['id'])+'/artifacts')['artifacts'];matches=[x for x in items if x['name']=='noa-membership-live-'+str(run['id'])];assert len(matches)==1
    out=Path('membership-evidence-proof');out.mkdir(exist_ok=True);archive=download_artifact(matches[0]['id'],out/'release.zip')
    ver=verified|ev.verified_artifact(matches[0],run['id'],commit,archive,'verified.json')
    t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t)as s:
            s.get_channel().settimeout(30)
            files=ev.source_readback(s,'.',commit,['noa-login.php','noa-membership.php','noa-membership.js','noa-account.js','noa-account.css','noa-sitemap.php','noa-bridge/subscription-core.php','noa-bridge/membership-core.php','noa-bridge/membership.php','noa-bridge/social-policy.php'])
            for remote,local in [('extend/noa.00-membership.php','deploy/noa-membership.extend.php'),('extend/zz.noa-social.php','deploy/noa-social.extend.php')]:
                with s.open(ev.HOST_ROOT+'/'+remote,'rb')as f:assert f.read()==Path(local).read_bytes()
            http=ev.http_evidence([{'url':ev.ORIGIN+p,'expectedStatus':status}for p,status in [('/',200),('/noa-login.php',200),('/noa-work-status.php',403)]])
            with s.open(ev.KEY_PATH,'rb')as f:key=f.read(129).strip()
    finally:t.close()
    proof=ev.build_event('deploy.verified','admin','integration-finish-20261024:membership-social','Work_Membership_20261026',commit,verified,ver,files,http)
    receipt=ev.publish(proof,key);snapshot=request(key,{'action':'read'});state=snapshot['state'];existing={x['id']:x for x in state['instructions']};entries=[]
    for name in ['MEMBERSHIP_REWARDS','SOCIAL_SIGNUP']:
        source=Path('docs/operations/requests/NOA_20261026_'+name+'.md').read_text()
        for i,part in enumerate(chunks(source)):
            ident='NOA-20261026-'+name.replace('_','-')+'-ORIGINAL-'+str(i+1)
            if ident not in existing:entries.append({'id':ident,'text':part,'areaIds':['P0-07','P0-08','P0-10','P0-11']})
    tasks=[('NOA-20261026-MEMBERSHIP-RUNTIME','회원 적립·VIP·우측 상단 표시·직접 가입 차단 운영 반영','complete','PHP/MySQL·두 테마 3개 모바일 폭·운영 임시 회원 9개 적립/차감 검증 통과',''),
           ('NOA-20261026-SOCIAL-SIGNUP','구글·카카오 가입 전용 화면과 서버 차단 반영','needs_review','직접 가입 GET/POST·소셜 세션 위조 차단 및 기존 로그인 유지','Google·Kakao 앱 키 미등록; 실제 외부 계정 가입 검증 대기'),
           ('NOA-20261026-MEMBERSHIP-REWARDS','확정 적립·등급·30일 VIP·자동연장 반영','needs_review','로그인만 0P·첫 댓글 130P·중복 방지·동일 서버 백업/복원 검증','현금 결제 설정 미등록; YouTube 시청 보상은 현행 비활성 유지')]
    for ident,text,status,last,error in tasks:
        if ident not in existing:entries.append({'id':ident,'text':text,'areaIds':['P0-07','P0-08','P0-10','P0-11']})
    rid='NOA-MEMBERSHIP-EVIDENCE-'+commit[:16]
    if rid not in state['requestReceipts']:
        changes=[{'id':ident,'status':status,'currentStage':text,'lastSuccessfulStage':last,'error':error,'evidenceIds':[receipt['eventId']]}for ident,text,status,last,error in tasks]
        payload={'action':'revise','request':{'requestId':rid,'expectedRevision':state['revision'],'changes':[],'appendInstructions':entries,'taskChanges':changes}}
        result=request(key,payload);assert result['readbackVerified'];assert request(key,payload)['effect']=='work_state_already_recorded'
    final=request(key,{'action':'read'});assert len(final['summary']['areas'])==12 and not final['summary']['allAreasComplete']
    (out/'receipt.json').write_text(json.dumps({'ok':True,'commit':commit,'runId':run['id'],'eventId':receipt['eventId'],'revision':final['state']['revision'],'originalAreasPreserved':True,'allAreasComplete':False},indent=2))
    print('N80_MEMBERSHIP_INSTRUCTIONS_AND_EVIDENCE_LINKED',json.dumps({'eventId':receipt['eventId'],'revision':final['state']['revision'],'allAreasComplete':False}))

if __name__=='__main__':
    if sys.argv[1:]==['build']:build()
    elif sys.argv[1:]==['record']:record()
    else:raise SystemExit('expected build or record')

"""Finish the scoped runtime journal only after completed deployment and live QA evidence."""
import json
import time
from pathlib import Path
import n80_completion_pipeline as pipeline
import n80_report_evidence as evidence


def jukebox_audits(commit, timeout=360):
    paths={'.github/workflows/n80-live-observer.yml', '.github/workflows/n80-app-integration.yml',
           '.github/workflows/n80-guardian-production-audit.yml'}
    deadline=time.monotonic()+timeout
    while True:
        runs=pipeline.api('/actions/runs?head_sha='+commit+'&per_page=100')['workflow_runs']
        selected={path:max((run for run in runs if run.get('path')==path and run.get('event')=='workflow_run'
                           and run.get('head_branch')=='main'),key=lambda run:run['id'],default=None) for path in paths}
        for run in selected.values():
            if run and run.get('status')=='completed':
                evidence.require(run.get('conclusion')=='success','jukebox_related_audit_failed:'+run['path'])
        if all(run and run.get('status')=='completed' for run in selected.values()):
            return [evidence.verified_run(pipeline.api('/actions/runs/'+str(run['id'])),run['id'],commit)
                    for path,run in sorted(selected.items())]
        evidence.require(time.monotonic()<deadline,'jukebox_related_audit_timeout')
        time.sleep(10)


def artifact(run, name, member, out):
    matches=[a for a in pipeline.api('/actions/runs/'+str(run['id'])+'/artifacts')['artifacts'] if a['name']==name]
    evidence.require(len(matches)==1,'runtime_artifact_missing')
    metadata=pipeline.api('/actions/artifacts/'+str(matches[0]['id']))
    archive=pipeline.download_artifact(metadata['id'],out/(member+'.zip'))
    return evidence.verified_artifact(metadata,run['id'],run['head_sha'],archive,member)


def finalize(event, scope="runtime"):
    import paramiko
    from noa_full_inventory import connect
    from noa_n80_ai_worker import worker_key
    from n80_workstate_sync import request
    evidence.require(scope in ("runtime","jukebox"),"invalid_runtime_scope")
    jukebox=scope=="jukebox"
    task="N80-20261108-JUKEBOX" if jukebox else "N80-20261107-RUNTIME"
    triggered=event.get('workflow_run',{});commit=triggered.get('head_sha','')
    evidence.require(event.get('repository',{}).get('full_name')==evidence.REPO,'event_repository_mismatch')
    evidence.require(triggered.get('head_branch')=='main' and triggered.get('event')=='push','untrusted_verification_event')
    run=pipeline.api('/actions/runs/'+str(triggered['id']))
    evidence.require(run.get('path')==pipeline.VERIFY_PATH,'wrong_verification_workflow')
    ver=evidence.verified_run(run,run['id'],commit)
    pipeline.DEPLOY_PATH='.github/workflows/noa-navigation-player.yml' if jukebox else '.github/workflows/n80-engine-facade-production.yml'
    dep=pipeline.deployment(commit,0);deployment=evidence.verified_run(dep,dep['id'],commit)
    audits=jukebox_audits(commit) if jukebox else []
    out=pipeline.output_directory()
    ver.update(artifact(run,pipeline.ARTIFACT_NAME+str(run['id']),'verified.json',out))
    # Native SQL projection/replay evidence must come from the same successful activation.
    artifact(dep,('n80-jukebox-' if jukebox else 'n80-single-runtime-')+str(dep['id']),'verification.json' if jukebox else 'runtime.json',out)
    if jukebox:
        import noa_navigation_release as release
    else:
        import n80_single_session_deploy as release
    paths=[p for p in release.release.FILES if evidence.safe_path(p)]
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            files=evidence.source_readback(sftp,'.',commit,paths)
    finally:transport.close()
    checks=evidence.http_evidence([{'url':evidence.ORIGIN+p,'expectedStatus':200} for p in ['/','/noa-login.php']])
    proof=evidence.build_event('deploy.verified','admin','integration-finish-20261024:'+task,'Work_N80',commit,deployment,ver,files,checks)
    key=worker_key();record=evidence.publish(proof,key);repeat=evidence.publish(proof,key)
    evidence.require(record['eventSha256']==repeat['eventSha256'],'runtime_evidence_replay_failed')
    current=request(key,{'action':'read'})['state'];ident='n80-'+scope+'-finish-'+commit[:20]
    change={'requestId':ident,'expectedRevision':current['revision'],'changes':[],'appendInstructions':([{'id':task,'text':'N80 JukeBox 전담 모듈 생성 및 재생·대기열·화면 이동·Android 연결 통합','areaIds':['P0-06','P0-10']}] if jukebox and not any(i['id']==task for i in current['instructions']) else []),
            'taskChanges':[{'id':task,'status':'complete',
              'currentStage':('N80 JukeBox 재생·페이지 이동·Android 호환 및 초안·공개 음원 연결 감사 완료.' if jukebox else 'N80 실행 연결·뮤비 비동기 큐·최종 파일 게시·공통 조회·모바일 회귀 검증 완료.'),
              'lastSuccessfulStage':'동일 커밋 배포·실서버 검증·재요청 증빙 연결: '+commit[:12],
              'error':'','evidenceIds':[record['eventId']]}]}
    receipt=({'readbackVerified':True,'state':current} if ident in current.get('requestReceipts',{}) else request(key,{'action':'revise','request':change}))
    evidence.require(receipt.get('readbackVerified') is True,'runtime_final_journal_not_verified')
    result={'ok':True,'eventId':record['eventId'],'commit':commit,'task':task,'status':'complete','journalRevision':receipt['state']['revision'],'parentAreasUnchanged':True}
    if jukebox:result['relatedAudits']=audits
    (out/'receipt.json').write_text(json.dumps(result));print('N80_JUKEBOX_COMPLETE' if jukebox else 'N80_RUNTIME_COMPLETE',json.dumps(result))

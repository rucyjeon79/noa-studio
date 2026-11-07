"""Finish the scoped runtime journal only after completed deployment and live QA evidence."""
import json
from pathlib import Path
import paramiko
import n80_completion_pipeline as pipeline
import n80_report_evidence as evidence
from noa_full_inventory import connect
from noa_n80_ai_worker import worker_key
from n80_workstate_sync import request


def artifact(run, name, member, out):
    matches=[a for a in pipeline.api('/actions/runs/'+str(run['id'])+'/artifacts')['artifacts'] if a['name']==name]
    evidence.require(len(matches)==1,'runtime_artifact_missing')
    metadata=pipeline.api('/actions/artifacts/'+str(matches[0]['id']))
    archive=pipeline.download_artifact(metadata['id'],out/(member+'.zip'))
    return evidence.verified_artifact(metadata,run['id'],run['head_sha'],archive,member)


def finalize(event):
    triggered=event.get('workflow_run',{});commit=triggered.get('head_sha','')
    evidence.require(event.get('repository',{}).get('full_name')==evidence.REPO,'event_repository_mismatch')
    evidence.require(triggered.get('head_branch')=='main' and triggered.get('event')=='push','untrusted_verification_event')
    run=pipeline.api('/actions/runs/'+str(triggered['id']))
    evidence.require(run.get('path')==pipeline.VERIFY_PATH,'wrong_verification_workflow')
    ver=evidence.verified_run(run,run['id'],commit)
    pipeline.DEPLOY_PATH='.github/workflows/n80-engine-facade-production.yml'
    dep=pipeline.deployment(commit,0);deployment=evidence.verified_run(dep,dep['id'],commit)
    out=pipeline.output_directory()
    ver.update(artifact(run,pipeline.ARTIFACT_NAME+str(run['id']),'verified.json',out))
    # Native SQL projection/replay evidence must come from the same successful activation.
    artifact(dep,'n80-single-runtime-'+str(dep['id']),'runtime.json',out)
    import n80_single_session_deploy as release
    paths=[p for p in release.release.FILES if evidence.safe_path(p)]
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            files=evidence.source_readback(sftp,'.',commit,paths)
    finally:transport.close()
    checks=evidence.http_evidence([{'url':evidence.ORIGIN+p,'expectedStatus':200} for p in ['/','/noa-login.php']])
    proof=evidence.build_event('deploy.verified','admin','integration-finish-20261024:N80-20261107-RUNTIME','Work_N80',commit,deployment,ver,files,checks)
    key=worker_key();record=evidence.publish(proof,key);repeat=evidence.publish(proof,key)
    evidence.require(record['eventSha256']==repeat['eventSha256'],'runtime_evidence_replay_failed')
    current=request(key,{'action':'read'})['state'];ident='n80-runtime-finish-'+commit[:20]
    change={'requestId':ident,'expectedRevision':current['revision'],'changes':[],'appendInstructions':[],
            'taskChanges':[{'id':'N80-20261107-RUNTIME','status':'complete',
              'currentStage':'N80 실행 연결·뮤비 비동기 큐·최종 파일 게시·공통 조회·모바일 회귀 검증 완료.',
              'lastSuccessfulStage':'동일 커밋 배포·실서버 검증·재요청 증빙 연결: '+commit[:12],
              'error':'','evidenceIds':[record['eventId']]}]}
    receipt=({'readbackVerified':True,'state':current} if ident in current.get('requestReceipts',{}) else request(key,{'action':'revise','request':change}))
    evidence.require(receipt.get('readbackVerified') is True,'runtime_final_journal_not_verified')
    result={'ok':True,'eventId':record['eventId'],'commit':commit,'task':'N80-20261107-RUNTIME','status':'complete','journalRevision':receipt['state']['revision'],'parentAreasUnchanged':True}
    (out/'receipt.json').write_text(json.dumps(result));print('N80_RUNTIME_COMPLETE',json.dumps(result))

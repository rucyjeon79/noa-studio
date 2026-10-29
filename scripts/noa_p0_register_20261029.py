"""Append this directive to N80 without replacing prior work or claiming completion."""
import hashlib
import json
import urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from n80_workstate_sync import request

IDENT = 'NOA-20261029-P0-INTEGRATION'
COMMIT = '22b7bb15e04139d5d3dc2f1be8b5c566e99fdbf1'
RUN = 40813209675
SHA = 'c1dc07ee1d3d16a1e02d08ad1ff6e18dac55549f258a15a533ba04e2a6afd301'

def main():
    with urllib.request.urlopen(f'https://api.github.com/repos/rucyjeon79/noa-studio/actions/runs/{RUN}', timeout=30) as response:
        run = json.load(response)
    if run['head_sha'] != COMMIT or run['conclusion'] != 'success' or run['event'] != 'push':
        raise RuntimeError('playback_release_not_verified')
    with urllib.request.urlopen('https://noastudio.ai.kr/noa-app/p0-player.js?verify='+COMMIT[:12], timeout=30) as response:
        if hashlib.sha256(response.read()).hexdigest() != SHA:
            raise RuntimeError('operating_player_changed')
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as s:
            s.get_channel().settimeout(30)
            with s.open('/hosting/noastudio/noa-ai-lab/worker.key', 'rb') as f:
                key = f.read(129).strip()
    finally:
        transport.close()
    if len(key) != 64: raise RuntimeError('invalid_worker_key')
    before = request(key, {'action':'read'})['state']
    entry = {'id':IDENT, 'text':'2026-10-29 P0 통합 정상화: 기존 1.0 기능·데이터와 진행 중인 Work를 보존하고 미완료 항목을 누적한다. 핵심 운영 기능 100%, 전체 검증 90% 이상이 목표이며 증거 없는 완료는 금지한다. SQL 원본 대조, AI 생성, 확정 UI, 카테고리, JUKEBOX, HOME/WORLD/MY, N80, 자동배포, Drive 백업을 검증한다. 기록: docs/operations/NOA_20261029_P0_RESULT.md', 'areaIds':['P0-'+str(i).zfill(2) for i in range(1,13)]}
    existing = {x['id']:x for x in before['instructions']}
    if IDENT in existing:
        if any(existing[IDENT][k] != entry[k] for k in entry):
            raise RuntimeError('directive_identity_conflict')
    else:
        payload = {'action':'revise','request':{'requestId':IDENT+'-APPEND','expectedRevision':before['revision'],'changes':[],'appendInstructions':[entry], 'taskChanges':[{'id':IDENT,'status':'in_progress','currentStage':'운영 감사 완료·플레이어 배포 검증; 나머지 통합 검증 진행','lastSuccessfulStage':'플레이어 배포 '+COMMIT+'; Actions '+str(RUN)+' 성공 및 운영 SHA256 일치','error':'AI 운영 키·활성화·비용 한도 미설정. 기존 비회원 UI 검사와 회원 전용 정책 불일치. 전체 완료 아님.','evidenceIds':[]}]}}
        first = request(key, payload)
        replay = request(key, payload)
        if first.get('readbackVerified') is not True or replay.get('effect') != 'work_state_already_recorded':
            raise RuntimeError('directive_readback_failed')
    after = request(key, {'action':'read'})
    latest = {x['id']:x for x in after['state']['instructions']}
    if after['state']['areas'] != before['areas'] or any(latest[k] != v for k,v in existing.items()):
        raise RuntimeError('concurrent_work_changed_review_required')
    result = {'revision':after['state']['revision'],'directiveId':IDENT,'existingInstructionsPreserved':True,'existingAreasPreserved':True,'allAreasComplete':after['summary']['allAreasComplete'],'workCompletedEventEmitted':False,'releaseRun':RUN,'releaseCommit':COMMIT,'playerSha256':SHA,'businessDatabaseWrites':0}
    out=Path('p0-current-proof');out.mkdir(exist_ok=True)
    (out/'directive.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print('P0_DIRECTIVE_REGISTERED',json.dumps(result,ensure_ascii=False))

if __name__ == '__main__': main()

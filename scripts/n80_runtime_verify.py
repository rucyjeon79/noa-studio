"""Read back the authenticated N80 service contract and update its existing project journal.

No generation, provider/key configuration, queue claim or business publication.
"""
import json
import os
from n80_live_observer import request_observation,request_music_consumer
from pathlib import Path
from noa_n80_ai_worker import worker_key, signed_tick
from n80_workstate_sync import request


def main():
    key = worker_key()
    native = signed_tick(key, 'n80_native_verify',json.dumps({'requestId':os.environ['GITHUB_SHA']}).encode())
    if set(native.get('operations',{}))!={'playlist','world','admin'} or not all(v.get('replayVerified') for v in native['operations'].values()):
        raise RuntimeError('native_runtime_readback_failed')
    observed=request_observation(key)['receipts'][0]
    first=request_music_consumer(key,observed);repeat=request_music_consumer(key,observed)
    if not repeat.get('replayed') or repeat['receipt']!=first['receipt']:raise RuntimeError('music_runtime_replay_failed')
    status = signed_tick(key, 'n80_status')
    if len(status.get('operations',{}))!=4 or any(v.get('state')!='verified' for v in status['operations'].values()):raise RuntimeError('runtime_evidence_not_connected')
    if (status.get('contractVersion') != 2 or status.get('generationRequests') != 0
            or status.get('runtime', {}).get('operation') != 'n80_status'):
        raise RuntimeError('n80_runtime_contract_readback_failed')
    result = {name: status[name] for name in ['contractVersion', 'workerEnabled', 'generation', 'taskCounts', 'checkedAt', 'runtime', 'generationRequests','operations','muvy','mediaPublication']}
    result['commit'] = os.environ['GITHUB_SHA']
    current = request(key, {'action': 'read'})['state']
    task_id = 'N80-20261107-RUNTIME'
    changes = []
    if not any(item['id'] == task_id for item in current['instructions']):
        changes = [{'id': task_id, 'text': 'N80 실행기 연결, 전담 처리기 분리, 중앙 등록부·작업 상태·예약 실행 통합. 전체 통합 완료는 모듈별 실제 실행 증거로 판단한다.', 'areaIds': ['P0-10', 'P0-11']}]
    update = {'requestId': 'n80-runtime-' + os.environ['GITHUB_SHA'][:20], 'expectedRevision': current['revision'],
              'changes': [], 'appendInstructions': changes,
              'taskChanges': [{'id': task_id, 'status': 'complete',
                               'currentStage': 'N80 실행 연결·뮤비 큐·미디어 최종 게시·공통 조회 전환 완료. 제공자 사용 가능 여부는 별도 준비상태로 표시.',
                               'lastSuccessfulStage': '배포 소스 대조 및 N80 상태 계약 v2 실서버 응답 확인: ' + os.environ['GITHUB_SHA'][:12],
                               'error': '', 'evidenceIds': []}]}
    receipt = ({'readbackVerified': True, 'state': current} if update['requestId'] in current.get('requestReceipts', {})
               else request(key, {'action': 'revise', 'request': update}))
    if not receipt.get('readbackVerified'):
        raise RuntimeError('n80_runtime_journal_readback_failed')
    result['journalRevision'] = receipt['state']['revision']
    result['scopeCompleted'] = True
    result['globalRuntimeCertification'] = 'not_claimed'
    result['nativeModules'] = native['operations']
    path = Path('ainoa-proof/runtime.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print('N80_RUNTIME_VERIFIED', json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()

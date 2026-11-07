"""Read back the authenticated N80 service contract and update its existing project journal.

No generation, provider/key configuration, queue claim or business publication.
"""
import json
import os
from pathlib import Path
from noa_n80_ai_worker import worker_key, signed_tick
from n80_workstate_sync import request


def main():
    key = worker_key()
    status = signed_tick(key, 'n80_status')
    if (status.get('contractVersion') != 2 or status.get('generationRequests') != 0
            or status.get('runtime', {}).get('operation') != 'n80_status'):
        raise RuntimeError('n80_runtime_contract_readback_failed')
    result = {name: status[name] for name in ['contractVersion', 'workerEnabled', 'generation', 'taskCounts', 'checkedAt', 'runtime', 'generationRequests']}
    result['commit'] = os.environ['GITHUB_SHA']
    current = request(key, {'action': 'read'})['state']
    task_id = 'N80-20261107-RUNTIME'
    changes = []
    if not any(item['id'] == task_id for item in current['instructions']):
        changes = [{'id': task_id, 'text': 'N80 실행기 연결, 전담 처리기 분리, 중앙 등록부·작업 상태·예약 실행 통합. 전체 통합 완료는 모듈별 실제 실행 증거로 판단한다.', 'areaIds': ['P0-10', 'P0-11']}]
    update = {'requestId': 'n80-runtime-' + os.environ['GITHUB_SHA'][:20], 'expectedRevision': current['revision'],
              'changes': [], 'appendInstructions': changes,
              'taskChanges': [{'id': task_id, 'status': 'in_progress',
                               'currentStage': 'N80 공통 실행·권한 경로 배포 및 인증 상태 조회 검증. 미설치 처리기와 장시간 생성 이관은 별도 검증 필요.',
                               'lastSuccessfulStage': '배포 소스 대조 및 N80 상태 계약 v2 실서버 응답 확인: ' + os.environ['GITHUB_SHA'][:12],
                               'error': '', 'evidenceIds': []}]}
    receipt = ({'readbackVerified': True, 'state': current} if update['requestId'] in current.get('requestReceipts', {})
               else request(key, {'action': 'revise', 'request': update}))
    if not receipt.get('readbackVerified'):
        raise RuntimeError('n80_runtime_journal_readback_failed')
    result['journalRevision'] = receipt['state']['revision']
    result['allRuntimeIntegrated'] = False
    path = Path('ainoa-proof/runtime.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print('N80_RUNTIME_VERIFIED', json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()

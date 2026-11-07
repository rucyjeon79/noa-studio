"""Live runtime checks stay strict; journal completion waits for persisted proof."""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
from unittest.mock import patch

# Isolate transport modules: this contract test must not contact production.
for module in ('n80_live_observer', 'noa_n80_ai_worker', 'n80_workstate_sync'):
    sys.modules[module] = types.ModuleType(module)
sys.modules['n80_live_observer'].request_observation = lambda key: {'receipts': [{}]}
sys.modules['n80_live_observer'].request_music_consumer = lambda key, receipt: {'replayed': True, 'receipt': 'same'}
sys.modules['noa_n80_ai_worker'].worker_key = lambda: b'fixture'
native = {'operations': {name: {'replayVerified': True} for name in ('playlist', 'world', 'admin')}}
status = dict(contractVersion=2, workerEnabled=True, generation={}, taskCounts={},
              checkedAt='fixture', runtime={'operation': 'n80_status'}, generationRequests=0,
              operations={name: {'state': 'verified'} for name in ('music', 'playlist', 'world', 'admin')},
              muvy={}, mediaPublication={})
sys.modules['noa_n80_ai_worker'].signed_tick = lambda key, operation, *args: native if operation == 'n80_native_verify' else status
updates = []
state = {'instructions': [], 'revision': 1, 'requestReceipts': {}}


def request(key, value):
    if value['action'] == 'read':
        return {'state': state}
    update = value['request']
    task = update['taskChanges'][0]
    # Mirror the real work-state contract that rejected the prior rollout.
    assert task['status'] != 'complete' or task['evidenceIds'], 'completion_requires_operating_evidence'
    updates.append(update)
    return {'readbackVerified': True, 'state': {'revision': 2}}


sys.modules['n80_workstate_sync'].request = request
sys.path.insert(0, str(Path('scripts').resolve()))
import n80_runtime_verify as verify

cwd = Path.cwd()
try:
    with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}):
        os.chdir(directory)
        with contextlib.redirect_stdout(io.StringIO()):
            verify.main()
        result = json.loads(Path('ainoa-proof/runtime.json').read_text())
        assert result['runtimeVerified'] is True
        assert result['scopeCompleted'] is False and result['completionEvidencePending'] is True
        assert updates[0]['taskChanges'][0]['status'] == 'needs_review'
        updates.clear()
        status['operations']['music']['state'] = 'failed'
        try:
            verify.main()
        except RuntimeError as error:
            assert str(error) == 'runtime_evidence_not_connected'
        else:
            raise AssertionError('Invalid live runtime must still block activation')
        assert updates == []
finally:
    os.chdir(cwd)
print('RUNTIME_JOURNAL_CONTRACT_OK')

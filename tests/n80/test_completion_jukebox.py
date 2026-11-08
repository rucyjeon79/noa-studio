"""A JukeBox completion receipt requires successful same-commit data audits."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import n80_runtime_finalize as finish

class JukeboxCompletionTest(unittest.TestCase):
    def rows(self):
        return [{'id':i,'path':'.github/workflows/'+name,'head_sha':'a'*40,'event':'workflow_run',
                 'head_branch':'main','status':'completed','conclusion':'success',
                 'repository':{'full_name':'rucyjeon79/noa-studio'},
                 'html_url':'https://github.com/rucyjeon79/noa-studio/actions/runs/'+str(i),
                 'updated_at':'2026-11-08T00:00:00Z'}
                for i,name in enumerate(['n80-live-observer.yml','n80-app-integration.yml','n80-guardian-production-audit.yml'],1)]
    def test_success_requires_all_three_audits_and_exact_commit(self):
        rows=self.rows()
        def api(path):return {'workflow_runs':rows} if '?' in path else next(r for r in rows if str(r['id'])==path.rsplit('/',1)[1])
        with patch.object(finish.pipeline,'api',side_effect=api):self.assertEqual(len(finish.jukebox_audits('a'*40,0)),3)
        rows[0]['head_sha']='b'*40
        with patch.object(finish.pipeline,'api',side_effect=api),self.assertRaisesRegex(finish.evidence.EvidenceError,'commit_mismatch'):finish.jukebox_audits('a'*40,0)
    def test_failure_or_missing_audit_cannot_mark_task_complete(self):
        rows=self.rows();rows[0]['conclusion']='failure'
        with patch.object(finish.pipeline,'api',return_value={'workflow_runs':rows}),self.assertRaisesRegex(finish.evidence.EvidenceError,'related_audit_failed'):finish.jukebox_audits('a'*40,0)
        with patch.object(finish.pipeline,'api',return_value={'workflow_runs':[]}),self.assertRaisesRegex(finish.evidence.EvidenceError,'related_audit_timeout'):finish.jukebox_audits('a'*40,0)

if __name__=='__main__':unittest.main()

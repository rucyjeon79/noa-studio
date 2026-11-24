import copy
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import busan_point_contract as b

POLICY=json.loads(b.POLICY_PATH.read_text(encoding='utf-8'))
BOARDS=[
    {'bo_table':'free','bo_write_point':20,'bo_comment_point':5,'bo_read_point':0,'bo_download_point':0},
    {'bo_table':'notice','bo_write_point':20,'bo_comment_point':5,'bo_read_point':0,'bo_download_point':0},
]
CONFIG={'cf_use_point':1,'cf_register_point':100,'cf_login_point':10,'cf_point_term':0}

class PointContractTests(unittest.TestCase):
    def setUp(self):
        self.policy=copy.deepcopy(POLICY)
        self.snapshot={'config':copy.deepcopy(CONFIG),'boards':copy.deepcopy(BOARDS)}

    def test_missing_production_snapshot_is_not_falsely_called_applied(self):
        report=b.audit(self.policy)
        self.assertEqual(report['status'],'snapshot_required')
        self.assertEqual(report['point_ledger_rows_changed'],0)

    def test_unknown_amounts_are_not_assumed_zero(self):
        report=b.audit(self.policy,self.snapshot)
        self.assertEqual(report['status'],'rates_unconfirmed')
        self.assertIn('bo_write_point',report['unconfirmed_target_fields'])
        self.assertEqual(report['existing_member_rows_changed'],0)
        self.assertEqual(report['observed_amounts']['cf_register_point'],[100])

    def test_detect_board_rate_disagreement(self):
        self.snapshot['boards'][1]['bo_write_point']=30
        report=b.audit(self.policy,self.snapshot)
        self.assertEqual(report['inconsistent_board_rates']['bo_write_point'],[20,30])

    def test_detect_configured_target_mismatch(self):
        self.policy['award_targets']['write_created']['amount']=25
        report=b.audit(self.policy,self.snapshot)
        self.assertEqual(report['status'],'drift_detected')
        self.assertEqual(report['mismatched_target_fields']['bo_write_point']['observed'],[20])

    def test_unapproved_auto_apply_rejected(self):
        self.policy['rollout']='apply'
        with self.assertRaisesRegex(ValueError,'unsafe automatic apply'):
            b.audit(self.policy)

    def test_missing_idempotence_guard_rejected(self):
        self.policy['safeguards']['reversal_requires_original_grant']=False
        with self.assertRaisesRegex(ValueError,'idempotence'):
            b.audit(self.policy)

    def test_bad_snapshot_with_member_rows_rejected(self):
        self.snapshot['members']=[{'mb_id':'example'}]
        with self.assertRaisesRegex(ValueError,'sanitized'):
            b.audit(self.policy,self.snapshot)

    def test_service_environment_cannot_be_swapped(self):
        self.policy['environment']='noa-studio'
        with self.assertRaisesRegex(ValueError,'environment'):
            b.audit(self.policy,self.snapshot)

    def test_excluded_board_is_not_a_rate_exception(self):
        self.policy['safeguards']['excluded_bo_tables']=['notice']
        self.snapshot['boards'][1]['bo_write_point']=1000
        report=b.audit(self.policy,self.snapshot)
        self.assertEqual(report['audited_board_count'],1)
        self.assertNotIn('bo_write_point',report['inconsistent_board_rates'])

if __name__=='__main__':unittest.main()

"""Read-only source guard: GitHub cannot reactivate legacy N80 host workers."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
WAKE=ROOT/".github/workflows/noa-ai-worker.yml"
SENDER=ROOT/"scripts/n80_signed_wake_signal.py"
APPROVALS=ROOT/"config/n80-approved-schedules.json"


class N80WakeIsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow=WAKE.read_text(encoding="utf-8")
        cls.sender=SENDER.read_text(encoding="utf-8")

    def test_only_one_disabled_job(self):
        self.assertRegex(self.workflow,r"(?m)^jobs:\n  wake:\n    if: \$\{\{ false \}\}")
        self.assertEqual(self.workflow.count("    if: ${{ false }}"),1)
        for name in ("host_runtime","process","host_handoff","browser_probe"):
            self.assertNotIn("  "+name+":\n",self.workflow)

    def test_no_unauthorized_event_or_cron(self):
        self.assertRegex(self.workflow,r"(?m)^on:\n  workflow_dispatch:\n")
        for banned in ("  schedule:\n","  push:\n","  pull_request:\n",
                       "  workflow_run:\n","  repository_dispatch:\n"):
            self.assertNotIn(banned,self.workflow)
        self.assertEqual(json.loads(APPROVALS.read_text(encoding="utf8"))["approved"],[])

    def test_no_github_business_executor_or_host_credentials(self):
        for banned in ("NOA_SSH_","NOA_FTP_","paramiko","scripts/n80_auto.py",
                       "noa_shorts_assembly.py","noa_daily_shorts.py",
                       "noa_jukebox_worker.py","nohup","node runtime/hub/"):
            with self.subTest(banned=banned):self.assertNotIn(banned,self.workflow)
        self.assertIn("python3 scripts/n80_signed_wake_signal.py",self.workflow)

    def test_explicit_host_and_github_approval_gates(self):
        for token in ("N80_WAKE_ACTIVATED:","N80_HOSTING_APPROVAL_VERIFIED:",
                      "N80_SCHEDULED_WAKE_KEY:","secrets.N80_SCHEDULED_WAKE_KEY"):
            self.assertIn(token,self.workflow)
        self.assertIn('env.get("GITHUB_EVENT_NAME") != "schedule"',self.sender)
        self.assertIn('env.get("N80_WAKE_ACTIVATED") != "true"',self.sender)
        self.assertIn('env.get("N80_HOSTING_APPROVAL_VERIFIED") != "true"',self.sender)

    def test_sender_has_exactly_one_protected_http_post(self):
        self.assertIn("https://noastudio.ai.kr/noa-bridge/n80-scheduled-wake.php",self.sender)
        self.assertIn('method="POST"',self.sender)
        self.assertIn("timeout=12",self.sender)
        self.assertIn("class NoRedirect(",self.sender)
        for banned in ("import paramiko","import subprocess","os.system(",
                       "Popen(","youtube.upload(","sftp.open("):
            self.assertNotIn(banned,self.sender)


if __name__=="__main__":
    unittest.main()

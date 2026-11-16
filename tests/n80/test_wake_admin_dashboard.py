"""Read-only N80 admin dashboard contract; never contacts production."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
HUB=ROOT/"deploy/noa-hub.php"


class WakeAdminDashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=HUB.read_text(encoding="utf-8")
        marker='<section id="n80-wake-preflight"'
        if cls.source.count(marker)!=1:
            raise AssertionError("missing_or_duplicate_dashboard")
        cls.panel=cls.source.split(marker,1)[1].split("</section>",1)[0]

    def test_authentication_gate_is_before_dashboard(self):
        self.assertIn("if(empty($is_member)||($is_admin??'')!=='super')",self.source)
        self.assertLess(self.source.index("if(empty($is_member)"),self.source.index('id="n80-wake-preflight"'))

    def test_read_only_report_uses_authoritative_snapshot(self):
        self.assertIn("$system['wakePreflight']",self.source)
        self.assertIn("$system['guardTriage']['items']",self.source)
        self.assertIn("empty($wakeChecks)?'사전검증 조회 불가'",self.panel)
        self.assertIn("$wakeChecks[$key]===true",self.source)
        self.assertIn("!empty($wakeReport['eligibleForSignedCanary'])",self.source)

    def test_contains_all_nine_allowlisted_checks(self):
        for key in (
            "residentRunnerRemoved","legacyStopLatched","githubSignalOnly",
            "dedicatedKeyMetadataSecure","clockConfigMatchesSender",
            "hostingApproval","boundedExecutor","oneShotOwnerEnabled",
            "hostWakePolicyActivated",
        ):
            with self.subTest(key=key):
                self.assertIn("'"+key+"'=>",self.source)

    def test_no_mutations_or_credentials_in_status_panel(self):
        for dangerous in ("<form","<button","<script","fetch(","n80_hub_write(",
                          "n80_hub_execute(","nohup","shell_exec(",
                          "getenv(","file_get_contents(","scheduled-wake.key",
                          "api_key","csrf","secret="):
            with self.subTest(dangerous=dangerous):
                self.assertNotIn(dangerous,self.panel)
        self.assertIn("자동 재시도하지 않습니다",self.panel)
        self.assertIn("조회 전용",self.panel)

    def test_accessibility_and_escaping(self):
        for token in ("role=\"status\"","scope=\"col\"","scope=\"row\"",
                      "aria-labelledby=","nh_e($label)","nh_e(count($batchReview))"):
            with self.subTest(token=token):
                self.assertIn(token,self.panel)


if __name__=="__main__":
    unittest.main()

"""Static guard regression: every N80 host-activating GitHub job needs owner consent.

This test does not connect to production, access credentials, invoke workers,
or launch any host process. It tests the reviewed workflow wiring.
"""
from pathlib import Path
import re
import unittest

SOURCE = Path(__file__).resolve().parents[2] / ".github/workflows/noa-ai-worker.yml"
HOST_JOBS = ("host_handoff", "host_runtime", "browser_probe", "host_media", "host_node")


def section(yaml, name):
    match = re.search(
        rf"(?ms)^  {re.escape(name)}:\n(.*?)(?=^  [a-z_]+:\n|\Z)",
        yaml,
    )
    if not match:
        raise AssertionError(f"missing_{name}")
    return match.group(1)


class N80HostActivationFenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.yaml = SOURCE.read_text(encoding="utf-8")

    def test_all_five_host_jobs_require_owner_stop_preflight(self):
        for name in HOST_JOBS:
            with self.subTest(name=name):
                part = section(self.yaml, name)
                self.assertIn("needs: [host_candidate, preflight]", part)
                self.assertIn("needs.preflight.outputs.allow == 'true'", part)

    def test_scheduled_worker_also_requires_owner_stop_preflight(self):
        process = section(self.yaml, "process")
        self.assertIn("needs: preflight", process)
        self.assertIn("needs.preflight.outputs.allow == 'true'", process)

    def test_preflight_does_not_run_on_untrusted_pull_requests(self):
        block = section(self.yaml, "preflight")
        self.assertIn("github.event_name != 'pull_request'", block)
        self.assertIn("run: python scripts/n80_host_pause_gate.py", block)
        self.assertIn("NOA_SSH_HOST: ${{ secrets.NOA_SSH_HOST }}", block)

    def test_safety_only_main_merge_does_not_restart_host_runtime(self):
        self.assertIn("[n80-safety-only]", section(self.yaml, "host_runtime"))
        self.assertIn("[n80-safety-only]", section(self.yaml, "host_handoff"))

    def test_sftp_preflight_does_not_launch_server_daemon(self):
        block = section(self.yaml, "preflight")
        for prohibited in ("runtime/launch.mjs", "ai.host_runtime", "engine.node_install",
                           "n80_auto.py", "noa_host_media_runtime.py"):
            self.assertNotIn(prohibited, block)

    def test_other_host_jobs_not_implicitly_allowed(self):
        for name in HOST_JOBS:
            with self.subTest(name=name):
                part = section(self.yaml, name)
                self.assertIn("needs.preflight.outputs.allow == 'true'", part)
                self.assertNotIn("always()", part.split("runs-on:", 1)[0])


if __name__ == "__main__":
    unittest.main()

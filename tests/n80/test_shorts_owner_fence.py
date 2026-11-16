"""N80 off-host Shorts pause must fence *in-flight* publication operations."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from n80_shorts_owner_fence import OwnerStopLatched, make_guarded_dispatch


class InflightOwnerFenceTest(unittest.TestCase):
    def setUp(self):
        self.clock_now = 100.
        self.probes = []
        self.sends = []
        self.enabled = True

        def check():
            self.probes.append(self.clock_now)
            return self.enabled, "owner_control_allows_work" if self.enabled else "owner_stop_or_pause_latched"

        def send(command="", **fields):
            self.sends.append((command, fields))
            return {"ok": True}

        self.dispatch = make_guarded_dispatch(send, check,
                                               clock=lambda: self.clock_now,
                                               max_age_seconds=10)

    def test_initial_tick_probes_before_send(self):
        self.dispatch()
        self.assertEqual(len(self.probes), 1)
        self.assertEqual(self.sends, [("", {})])

    def test_owner_stop_during_job_blocks_next_claim(self):
        self.dispatch("catalog")
        self.enabled = False
        with self.assertRaisesRegex(OwnerStopLatched, "owner_stop"):
            self.dispatch("assembly_claim")
        self.assertEqual(self.sends, [("catalog", {})])

    def test_owner_stop_during_source_analysis_blocks_next_source(self):
        self.dispatch("youtube")
        self.enabled = False
        with self.assertRaises(OwnerStopLatched):
            self.dispatch("source", trackKey="song:31")
        self.assertEqual(len(self.sends), 1)

    def test_repeated_chunks_use_bounded_sftp_checks(self):
        for i in range(30):
            self.dispatch("assembly_read", offset=i)
            self.clock_now += .2
        self.assertEqual(len(self.probes), 1)
        self.clock_now += 11
        self.dispatch("assembly_read", offset=30)
        self.assertEqual(len(self.probes), 2)

    def test_chunk_stop_is_fenced_after_max_age(self):
        self.dispatch("storage_read", offset=0)
        self.enabled = False
        self.clock_now += 11
        with self.assertRaises(OwnerStopLatched):
            self.dispatch("storage_read", offset=1)
        self.assertEqual(len(self.sends), 1)

    def test_publication_completion_forces_new_owner_probe(self):
        self.dispatch("catalog")
        self.enabled = False
        with self.assertRaises(OwnerStopLatched):
            self.dispatch("storage_complete", receipt={"readbackVerified": True})
        self.assertEqual(len(self.sends), 1)

    def test_expensive_media_checkpoint_is_explicit_and_unconditional(self):
        self.dispatch("catalog")
        self.enabled = False
        with self.assertRaises(OwnerStopLatched):
            self.dispatch.require_owner()
        self.assertEqual(len(self.sends), 1)

    def test_control_unreachable_fails_closed_before_send(self):
        def failing_probe():
            raise OSError("unavailable")
        send_calls = []
        f = make_guarded_dispatch(lambda c="", **fields: send_calls.append(c),
                                  failing_probe, clock=lambda: self.clock_now)
        with self.assertRaisesRegex(OwnerStopLatched, "unreachable"):
            f("claim_preparation")
        self.assertEqual(send_calls, [])

    def test_interval_bounds_reject_unbounded_cached_permission(self):
        with self.assertRaises(ValueError):
            make_guarded_dispatch(lambda *a, **k: None, lambda: (True, ""),
                                  max_age_seconds=31)
        with self.assertRaises(ValueError):
            make_guarded_dispatch(lambda *a, **k: None, lambda: (True, ""),
                                  max_age_seconds=0)

    def test_source_guards_enforced_before_upload_or_render(self):
        root = Path(__file__).resolve().parents[2]
        for path in ("scripts/noa_shorts_storage.py", "scripts/noa_shorts_assembly.py"):
            with self.subTest(path=path):
                source = (root / path).read_text(encoding="utf-8")
                self.assertIn("getattr(dispatch, 'require_owner', None)", source)
                self.assertIn("owner_check()", source)


if __name__ == "__main__":
    unittest.main()

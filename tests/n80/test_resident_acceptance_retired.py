"""Legacy entry point refuses before credentials, connections or process startup."""
import runpy
import socket
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/n80_specialist_host_acceptance.py"


class ResidentAcceptanceRetired(unittest.TestCase):
    def test_refuses_without_host_or_subprocess_access(self):
        with patch.object(socket, "socket", side_effect=AssertionError("network attempted")), \
                patch.object(subprocess, "Popen", side_effect=AssertionError("process attempted")), \
                patch.dict("sys.modules", {"paramiko": None, "noa_full_inventory": None,
                                           "noa_n80_ai_worker": None}):
            with self.assertRaises(SystemExit) as error:
                runpy.run_path(str(SCRIPT), run_name="__main__")
        self.assertEqual(str(error.exception), "resident_runner_retired_use_noa_hub_status")


if __name__ == "__main__":
    unittest.main()

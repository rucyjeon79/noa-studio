"""Host ownership is authoritative even when its runner is paused or unreachable."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('n80_auto', Path(__file__).resolve().parents[2] / 'scripts/n80_auto.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

class Ownership(unittest.TestCase):
    def response(self, value):
        return io.BytesIO(json.dumps(value).encode())

    def test_host_owner_never_falls_back_for_paused_runner(self):
        with patch.object(runtime.urllib.request, 'urlopen', return_value=self.response({'ok': True, 'operation': 'ai.text', 'owner': 'n80_hub', 'paused': True})):
            self.assertTrue(runtime.host_owned('ai.text'))

    def test_network_or_missing_owner_never_authorizes_execution(self):
        for error in [HTTPError('https://noastudio.ai.kr', 404, '', None, None), URLError('offline')]:
            with patch.object(runtime.urllib.request, 'urlopen', side_effect=error):
                with self.assertRaises(Exception): runtime.host_owned('ai.text')
        for body in [{'ok': False}, {'ok': True, 'operation': 'ai.text', 'owner': 'unknown'}, {'ok': True, 'operation': 'catalog.index', 'owner': 'legacy'}]:
            with patch.object(runtime.urllib.request, 'urlopen', return_value=self.response(body)):
                with self.assertRaisesRegex(RuntimeError, 'ownership_unconfirmed'): runtime.host_owned('ai.text')

    def test_only_explicit_legacy_owner_can_execute(self):
        with patch.object(runtime.urllib.request, 'urlopen', return_value=self.response({'ok': True, 'operation': 'members.maintain', 'owner': 'legacy'})):
            self.assertFalse(runtime.host_owned('members.maintain'))

    def test_cover_owner_gate_uses_same_authoritative_host(self):
        with patch.object(runtime.urllib.request, 'urlopen', return_value=self.response({'ok': True, 'operation': 'covers.refresh', 'owner': 'n80_hub'})):
            self.assertTrue(runtime.host_owned('covers.refresh'))

    def test_unmigrated_media_keeps_existing_owner(self):
        with patch.object(runtime.urllib.request, 'urlopen') as request:
            self.assertFalse(runtime.host_owned('ai.media_guard'))
            request.assert_not_called()

if __name__ == '__main__': unittest.main()

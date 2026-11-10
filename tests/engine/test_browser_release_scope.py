import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('browser_scope', ROOT / 'scripts/noa_browser_release_scope.py')
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


class BrowserScope(unittest.TestCase):
    def test_browser_paths_and_fixture_changes(self):
        self.assertTrue(scope.browser_only(['deploy/noa-browser-connect.js', 'tests/browser-relay/http_test.py']))
        self.assertTrue(scope.browser_only(list(scope.FILES)))

    def test_unknown_empty_or_mixed_changes_require_full_checks(self):
        for paths in [[], ['deploy/noa-ai-lab.php'], ['runtime/browser/relay.mjs'],
                      ['deploy/noa-browser-connect.js', 'bridge/lab-core.php'],
                      ['tests/browser-relay-other/test.py']]:
            self.assertFalse(scope.browser_only(paths))


if __name__ == '__main__':
    unittest.main()

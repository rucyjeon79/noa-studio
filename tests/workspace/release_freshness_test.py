"""Exercise deployment freshness against real commit histories, without a host."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('freshness', ROOT / 'scripts/noa_release_freshness.py')
freshness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(freshness)
UNRELATED = ('scripts/busan_', '.github/workflows/busan-', 'docs/busan/')


class FreshnessTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Release Test')
        self.git('config', 'user.email', 'release-test@example.invalid')
        self.base = self.commit('deploy/noa-browse.js', 'tested source')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.PIPE).decode().strip()

    def commit(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def check(self, head, candidate=None, prefixes=UNRELATED):
        freshness.require_current_candidate(head, candidate or self.base, prefixes, cwd=self.root)

    def test_current_commit(self):
        self.check(self.base)

    def test_unrelated_bus_dev_does_not_starve_release(self):
        for path in ['scripts/busan_push.py', '.github/workflows/busan-widget.yml', 'docs/busan/result.md']:
            self.check(self.commit(path, 'separate host'))

    def test_other_releases_stay_strict(self):
        with self.assertRaisesRegex(RuntimeError, 'obsolete_candidate'):
            self.check(self.commit('scripts/busan_push.py', 'separate host'), prefixes=())

    def test_noa_source_dependency_and_gate_changes_require_retest(self):
        for path in ['deploy/noa-browse.js', 'bridge/library-records.php', 'scripts/noa_ainoa_deploy.py',
                     'tests/workspace/fixture.php', '.github/workflows/noa-workspace.yml', 'package.json']:
            with self.subTest(path=path):
                with self.assertRaisesRegex(RuntimeError, 'obsolete_candidate'):
                    self.check(self.commit(path, 'changed'))

    def test_rename_out_of_noa_is_rejected(self):
        (self.root / 'scripts').mkdir()
        self.git('mv', 'deploy/noa-browse.js', 'scripts/busan_moved.js')
        self.git('commit', '-qm', 'rename')
        with self.assertRaisesRegex(RuntimeError, 'obsolete_candidate'):
            self.check(self.git('rev-parse', 'HEAD'))

    def test_rewind_and_divergent_history_are_rejected(self):
        candidate = self.commit('scripts/busan_push.py', 'first')
        with self.assertRaises(subprocess.CalledProcessError):
            self.check(self.base, candidate)
        self.git('checkout', '-qb', 'other', self.base)
        head = self.commit('scripts/busan_push.py', 'other')
        with self.assertRaises(subprocess.CalledProcessError):
            self.check(head, candidate)

    def test_invalid_sha_is_rejected_before_git(self):
        with self.assertRaisesRegex(RuntimeError, 'invalid_release_commit'):
            self.check('--upload-pack=invalid')


if __name__ == '__main__':
    unittest.main()

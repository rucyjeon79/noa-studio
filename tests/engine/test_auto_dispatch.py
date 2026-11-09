import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('n80_auto', ROOT / 'scripts/n80_auto.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class AutoDispatch(unittest.TestCase):
    def test_only_declared_workflow_can_execute_operation(self):
        manifest = json.loads((ROOT / 'config/n80-automation.json').read_text())
        for operation, row in manifest['operations'].items():
            env = {'GITHUB_REPOSITORY': 'rucyjeon79/noa-studio',
                   'GITHUB_WORKFLOW_REF': 'rucyjeon79/noa-studio/.github/workflows/' + row['workflow'] + '@refs/heads/main',
                   **row['requiredEnv']}
            self.assertEqual(runtime.plan(operation, env), row)
            self.assertTrue((ROOT / row['command'][0]).is_file())
            workflow = (ROOT / '.github/workflows' / row['workflow']).read_text()
            if operation == 'ai.daily_shorts':
                self.assertIn('uses: ./.github/actions/n80-daily-shorts', workflow)
                action = (ROOT / '.github/actions/n80-daily-shorts/index.cjs').read_text()
                self.assertIn("['scripts/n80_auto.py', 'ai.daily_shorts']", action)
            else:
                self.assertIn('scripts/n80_auto.py ' + operation, workflow)
            with self.assertRaisesRegex(RuntimeError, 'owner_mismatch'):
                runtime.plan(operation, {**env, 'GITHUB_WORKFLOW_REF': env['GITHUB_WORKFLOW_REF'].replace('@refs/heads/main', '@refs/heads/other')})
            for key in row['requiredEnv']:
                with self.assertRaisesRegex(RuntimeError, 'runtime_mode_required'):
                    runtime.plan(operation, {**env, key: 'invalid'})

    def test_unknown_operation_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'unregistered'):
            runtime.plan('deploy-anything', {})


if __name__ == '__main__':
    unittest.main()

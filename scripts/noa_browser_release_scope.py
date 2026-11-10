"""Select browser-only checks and deployment; unknown or mixed changes use the full gate."""
import os
import re
import subprocess

FILES = {
    'deploy/noa-browser-connect.php', 'deploy/noa-browser-connect.js',
    'deploy/noa-browser-connect.css', 'bridge/browser-control.php',
    'bridge/worker-browser.php', '.github/workflows/noa-lab-entry.yml',
    'scripts/noa_browser_release_scope.py', 'tests/engine/test_browser_release_scope.py',
}


def browser_only(paths):
    return bool(paths) and all(p in FILES or p.startswith('tests/browser-relay/') for p in paths)


def main():
    base = os.getenv('N80_COMPARE_BASE', '')
    selected = False
    if re.fullmatch('[a-f0-9]{40}', base) and base != '0' * 40:
        try:
            paths = subprocess.check_output(['git', 'diff', '--name-only', base, 'HEAD'], text=True).splitlines()
            selected = browser_only(paths)
        except subprocess.CalledProcessError:
            pass
    with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
        out.write('browser_only=' + str(selected).lower() + '\n')
    print('N80_VERIFICATION_SCOPE', 'browser' if selected else 'full')


if __name__ == '__main__':
    main()

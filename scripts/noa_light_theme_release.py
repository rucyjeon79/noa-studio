"""Release the premium day/night palettes and scheduled preferences with existing hash/rollback guards."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release

release.FILES = {'noa-bridge/ui-preferences.php': 'bridge/ui-preferences.php', **{name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json', 'noa-ui.js', 'noa-theme-admin.php', 'noa-app/home.php')}}
release.NEW = set()
release.BACKUP = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-light-theme-before.json'

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

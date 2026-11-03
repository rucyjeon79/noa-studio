"""Release only the shared light/dark palette, navigation/control contrast and stylesheet with existing hash/rollback guards."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release

release.FILES = {name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json')}
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

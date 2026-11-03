"""Release the expansive home, searchable drawer and width-based media layout with accessible dialog lifecycle and existing hash/rollback guards."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release

theme_assets = {'noa-assets/theme-' + p.name: str(p) for p in sorted(Path('public/noa-theme-scenes').glob('*.webp'))}
release.FILES = {**theme_assets, 'noa-bridge/ui-preferences.php': 'bridge/ui-preferences.php', **{name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json', 'noa-ui.js', 'noa-desktop.js', 'noa-theme-admin.php', 'noa-app/home.php')}}
release.NEW = set(theme_assets)
release.BACKUP = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-light-theme-before.json'

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

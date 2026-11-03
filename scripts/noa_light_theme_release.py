"""Publish aligned utility navigation, social sign-in and dialogs alongside the current personal listening integration."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release

# Busan has a separate host. Any NOA source, dependency or verification change still requires a new candidate.
release.UNRELATED_PATH_PREFIXES = ('scripts/busan_', '.github/workflows/busan-', 'docs/busan/', 'deploy/busan/')

theme_assets = {'noa-assets/theme-' + p.name: str(p) for p in sorted(Path('public/noa-theme-scenes').glob('*.webp'))}
release.FILES = {**theme_assets, 'noa-bridge/ui-preferences.php': 'bridge/ui-preferences.php', **{name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json', 'noa-ui.js', 'noa-home.js', 'noa-desktop.js', 'noa-theme-admin.php', 'noa-vip.php', 'noa-app/home.php')}}
release.FILES['extend/noa.design.php'] = 'deploy/noa-design.extend.php'
release.FILES.update({name: 'deploy/' + name for name in ('noa-account.js', 'noa-voice.js', 'noa-ainoa.css', 'noa-amt-fan.js', 'noa-amt-fan.css')})
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

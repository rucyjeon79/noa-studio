"""Publish the two-frame header and verified location weather, with four-language controls, a first-paint palette and the current personal-listening interface."""
import os
import sys
from pathlib import Path
import noa_ainoa_deploy as release

# Busan has a separate host. Any NOA source, dependency or verification change still requires a new candidate.
release.UNRELATED_PATH_PREFIXES = ('scripts/busan_', '.github/workflows/busan-', 'docs/busan/', 'deploy/busan/')

theme_assets = {'noa-assets/theme-' + p.name: str(p) for p in sorted(Path('public/noa-theme-scenes').glob('*.webp'))}
release.FILES = {**theme_assets, 'noa-bridge/ui-preferences.php': 'bridge/ui-preferences.php', **{name: 'deploy/' + name for name in ('noa-starlight.css', 'noa-design.json', 'noa-ui.js', 'noa-home.js', 'noa-desktop.js', 'noa-theme-admin.php', 'noa-vip.php', 'noa-app/home.php')}}
release.FILES['extend/noa.design.php'] = 'deploy/noa-design.extend.php'
release.FILES.update({name: 'deploy/' + name for name in ('noa-account.js', 'noa-youngcart-premium.css', 'noa-voice.js', 'noa-ainoa.css', 'noa-amt-fan.js', 'noa-amt-fan.css', 'noa-sitemap.php')})
release.FILES = {'noa-interface-labels.json':'deploy/noa-interface-labels.json','noa-bridge/weather.php':'bridge/weather.php', **release.FILES}
release.FILES.update({'noa-youngcart.php':'deploy/noa-youngcart.php','extend/zz.noa-youngcart.php':'deploy/noa-youngcart.extend.php'})
release.FILES.update({name:'deploy/'+name for name in ('noa-hero.js','noa-listening.js','noa-listening.css','noa-music.php','noa-music-vinyl.css')})
release.FILES.update({'noa-bridge/home.php':'bridge/home.php','noa-bridge/home-core.php':'bridge/home-core.php'})
# These two items are owned and checked byte-for-byte by this coordinated release.
release.PROTECTED = [name for name in release.PROTECTED if name not in ('noa-hero.js','noa-music.php')]
release.NEW = set(theme_assets) | {'noa-bridge/weather.php','noa-interface-labels.json'}
release.BACKUP = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-light-theme-before.json'

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

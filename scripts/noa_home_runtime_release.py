"""Install the home-only public asset transport; preserve every existing application file."""
import sys
import noa_ainoa_deploy as release

release.FILES = {
    'noa-home-assets-lib.php': 'deploy/noa-home-assets-lib.php',
    'noa-home-assets.php': 'deploy/noa-home-assets.php',
    'extend/00.noa-home-performance.php': 'deploy/noa-home-performance.extend.php',
}
release.NEW = set(release.FILES)

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

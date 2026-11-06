"""Publish the Suno field and its two existing save handlers together."""
import sys
import noa_ainoa_deploy as release

release.FILES = {
    'noa-bridge/suno-cover.php': 'bridge/suno-cover.php',
    'noa-record-form.css': 'deploy/noa-record-form.css',
    'noa-record-form.js': 'deploy/noa-record-form.js',
    'noa-bridge/creator.php': 'bridge/creator.php',
    'noa-inline-edit.php': 'deploy/noa-inline-edit.php',
    'noa-creator.js': 'deploy/noa-creator.js',
    'noa-browse-edit.js': 'deploy/noa-browse-edit.js',
}
release.NEW = {'noa-bridge/suno-cover.php'}

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

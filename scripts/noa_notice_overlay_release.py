"""Publish only the shared notice renderer and its matching presentation."""
import sys
import noa_ainoa_deploy as release

release.FILES = {name: 'deploy/' + name for name in ('noa-ainoa.css', 'noa-voice.js')}
release.NEW = set()

if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

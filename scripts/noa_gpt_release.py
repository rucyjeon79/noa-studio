"""Deploy only the private GPT bridge, configuration page, schema and editor control."""
import sys
import noa_ainoa_deploy as release

release.FILES = {name: 'deploy/'+name for name in (
    'noa-publish-set.php','noa-plugin-records.php','noa-gpt.php','noa-gpt-schema.json','noa-gpt-setup.php','noa-browse-edit.js')}
release.FILES = {'noa-app/engine/song-generation.php':'deploy/noa-app/engine/song-generation.php','noa-work-status.php':'deploy/noa-work-status.php','noa-bridge/generation-rules.php':'bridge/generation-rules.php',**release.FILES,'noa-bridge/ainoa-generation.php':'bridge/ainoa-generation.php'}
release.NEW = set(release.FILES) - {'noa-browse-edit.js'}
if __name__ == '__main__':
    try:
        release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback')
            release.main()
        raise

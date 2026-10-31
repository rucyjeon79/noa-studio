"""Publish the five room identities and account theme selection."""
import sys
import noa_ainoa_deploy as release
release.FILES={f'noa-assets/room-{name}.svg':f'deploy/noa-assets/rooms/{name}.svg' for name in ('constellation','letter','grooves')}
release.NEW=set(release.FILES)
release.FILES.update({name:'deploy/'+name for name in ('noa-design.json','noa-starlight.css','noa-ui.js','noa-settings.php')})
release.FILES['noa-bridge/ui-preferences.php']='bridge/ui-preferences.php'
if __name__=='__main__':
    try:release.main()
    except Exception:
        if 'rollback' not in sys.argv and release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise

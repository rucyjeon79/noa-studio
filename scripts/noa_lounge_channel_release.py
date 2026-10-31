import noa_ainoa_deploy as release
release.FILES={'noa-app/ecosystem-view.php':'deploy/noa-app/ecosystem-view.php','noa-community.js':'deploy/noa-community.js','noa-ecosystem.css':'deploy/noa-ecosystem.css','noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-cinema.css':'deploy/noa-cinema.css','noa-ecosystem.js':'deploy/noa-ecosystem.js','noa-bridge/lounge-channel.php':'bridge/lounge-channel.php','noa-lounge-channel.js':'deploy/noa-lounge-channel.js','extend/zz.noa-lounge-channel.php':'deploy/noa-lounge-channel.extend.php'}
release.NEW=set(release.FILES)
if __name__=='__main__':
    import sys
    try: release.main()
    except Exception:
        if release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise

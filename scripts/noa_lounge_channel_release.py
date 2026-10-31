import noa_ainoa_deploy as release
release.FILES={'noa-app/home.php':'deploy/noa-app/home.php','noa-app/monthly-banner.php':'deploy/noa-app/monthly-banner.php','noa-referral.css':'deploy/noa-referral.css','noa-referral.js':'deploy/noa-referral.js','noa-community.css':'deploy/noa-community.css','noa-app/ecosystem-view.php':'deploy/noa-app/ecosystem-view.php','noa-community.js':'deploy/noa-community.js','noa-ecosystem.css':'deploy/noa-ecosystem.css','noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-cinema.css':'deploy/noa-cinema.css','noa-ecosystem.js':'deploy/noa-ecosystem.js','noa-bridge/lounge-channel.php':'bridge/lounge-channel.php','noa-lounge-channel.js':'deploy/noa-lounge-channel.js','extend/zz.noa-lounge-channel.php':'deploy/noa-lounge-channel.extend.php'}
for artwork in ('invitation', 'constellation', 'song-letter'):
    release.FILES[f'noa-assets/banner-{artwork}.svg'] = f'public/banner-art/{artwork}.svg'
release.NEW=set(release.FILES)
if __name__=='__main__':
    import sys
    try: release.main()
    except Exception:
        if release.BACKUP.exists():
            sys.argv.append('rollback');release.main()
        raise

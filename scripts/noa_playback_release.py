import noa_ainoa_deploy as release
release.FILES={'noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-launch.js':'deploy/noa-launch.js','noa-music.php':'deploy/noa-music.php'}
release.NEW=set()
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()

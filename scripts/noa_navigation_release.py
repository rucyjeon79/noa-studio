import noa_ainoa_deploy as release
release.FILES={'noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-launch.js':'deploy/noa-launch.js'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()

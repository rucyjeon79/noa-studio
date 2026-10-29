import noa_ainoa_deploy as release
release.FILES={'noa-app/jukebox/core.php':'deploy/noa-app/jukebox/core.php','noa-bridge/music-readmodel.php':'bridge/music-readmodel.php','noa-app/jukebox/stream.php':'deploy/noa-app/jukebox/stream.php','noa-engagement.css':'deploy/noa-engagement.css'}
release.NEW=set()
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()

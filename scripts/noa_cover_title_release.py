import noa_ainoa_deploy as release
release.FILES={'noa-bridge/music-readmodel.php':'bridge/music-readmodel.php','noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php','noa-bridge/channel-view.php':'bridge/channel-view.php','noa-browse.js':'deploy/noa-browse.js','noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-music.php':'deploy/noa-music.php'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()

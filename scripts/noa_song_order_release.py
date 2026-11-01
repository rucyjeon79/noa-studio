import noa_ainoa_deploy as release
release.FILES={'noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php','noa-bridge/library-records.php':'bridge/library-records.php','noa-music.php':'deploy/noa-music.php','noa-browse.js':'deploy/noa-browse.js'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()

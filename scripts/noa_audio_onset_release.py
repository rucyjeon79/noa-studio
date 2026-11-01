import noa_ainoa_deploy as release
release.FILES={'noa-app/jukebox/stream.php':'deploy/noa-app/jukebox/stream.php','noa-music.php':'deploy/noa-music.php'}
release.NEW=set()
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__': release.main()

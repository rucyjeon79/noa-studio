"""Release only upload reservation button identity correction; no data writes."""
import noa_ainoa_deploy as release
release.FILES={'noa-app/jukebox/upload.js':'deploy/noa-app/jukebox/upload.js'}
release.NEW=set()
if __name__=='__main__':release.main()

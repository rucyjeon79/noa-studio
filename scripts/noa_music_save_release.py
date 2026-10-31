"""Only deploy the authenticated download page and device-local save UI."""
import noa_ainoa_deploy as release
release.FILES={'noa-music-save.js':'deploy/noa-music-save.js','noa-music-download.php':'deploy/noa-music-download.php'}
release.NEW={'noa-music-save.js'}
if __name__=='__main__':release.main()

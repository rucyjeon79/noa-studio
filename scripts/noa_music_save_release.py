"""Only deploy the authenticated download page and device-local save UI."""
import noa_ainoa_deploy as release
release.FILES={'noa-bridge/music-download-core.php':'bridge/music-download-core.php','noa-app/jukebox/download.php':'deploy/noa-app/jukebox/download.php','noa-music-save.js':'deploy/noa-music-save.js','noa-music-download.php':'deploy/noa-music-download.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
# These independent release paths do not participate in folder selection or its deployment.
release.UNRELATED_PATH_PREFIXES=('android/', 'tests/gpt/', 'tests/jukebox/', 'scripts/qa/noa-upload-buttons.mjs')
release.NEW={'noa-music-save.js'}
if __name__=='__main__':release.main()

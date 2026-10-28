"""User-authorized download economics and in-card processing, with prior-source protection."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-bridge/music-download-core.php':'bridge/music-download-core.php',
 'noa-music-download.php':'deploy/noa-music-download.php',
 'noa-premium.js':'deploy/noa-premium.js',
 'noa-app/jukebox/upload.css':'deploy/noa-app/jukebox/upload.css',
 'noa-engagement.css':'deploy/noa-engagement.css',
 'noa-app/jukebox/download.php':'deploy/noa-app/jukebox/download.php',
 'noa-app/jukebox/upload.js':'deploy/noa-app/jukebox/upload.js',
 'noa-app/jukebox/index.php':'deploy/noa-app/jukebox/index.php',
 **{p:'deploy/'+p for p in ['noa-music.php','noa-creator.php','noa-creator.js','noa-ui.js','noa-subscription.js']},
 'noa-bridge/member-access.php':'bridge/member-access.php',
}
release.NEW={'noa-bridge/music-download-core.php','noa-music-download.php','noa-premium.js'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]+['noa-bridge/subscription-core.php','noa-bridge/membership-core.php','noa-app/jukebox/core.php','noa-app/jukebox/upload-core.php','noa-app/jukebox/queue-core.php','noa-bridge/popularity-core.php','noa-bridge/notifications-core.php']
if __name__=='__main__':release.main()

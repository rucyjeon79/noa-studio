"""N80 JukeBox source activation. One existing release path, no worker or new queue."""
import noa_ainoa_deploy as release
release.FILES={
 'noa-app/playback-recovery.js':'deploy/noa-app/playback-recovery.js',
 'noa-app/engine/jukebox.php':'deploy/noa-app/engine/jukebox.php',
 **{'noa-app/jukebox/'+name:'deploy/noa-app/jukebox/'+name for name in ['navigation-policy.js','system-media.js','player.js','presentation.js']},
 'noa-app/engine/registry.php':'deploy/noa-app/engine/registry.php',
 'extend/noa.design.php':'deploy/noa-design.extend.php',
 **{name:'deploy/'+name for name in ['noa-launch.js','noa-playcount.js','noa-playlists.js','noa-listening.js','noa-music.php']},
 'noa-app/p0-player.js':'deploy/noa-app/p0-player.js',
}
release.NEW={'noa-app/jukebox/system-media.js','noa-app/engine/jukebox.php','noa-app/jukebox/navigation-policy.js','noa-app/jukebox/player.js','noa-app/jukebox/presentation.js'}
release.PROTECTED=[path for path in release.PROTECTED if path not in release.FILES]
if __name__=='__main__':release.main()

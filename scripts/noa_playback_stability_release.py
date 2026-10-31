"""Scoped transient playback recovery; no media, database or worker changes."""
import noa_ainoa_deploy as release
release.FILES={'noa-app/playback-recovery.js':'deploy/noa-app/playback-recovery.js','noa-app/p0-player.js':'deploy/noa-app/p0-player.js','noa-music.php':'deploy/noa-music.php'}
release.NEW={'noa-app/playback-recovery.js'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
if __name__=='__main__':release.main()

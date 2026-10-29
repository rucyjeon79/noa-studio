"""Scoped collection-to-player queue integration; no database changes."""
import noa_ainoa_deploy as release
release.FILES={'noa-browse.js':'deploy/noa-browse.js','noa-music.php':'deploy/noa-music.php'}
release.PROTECTED=[p for p in release.PROTECTED if p not in release.FILES]
release.NEW=set()
if __name__=='__main__':release.main()

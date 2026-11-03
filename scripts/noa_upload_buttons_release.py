"""Publish the song editor's audio control and its upload progress renderer."""
import noa_ainoa_deploy as release
release.FILES={'noa-app/jukebox/upload.js':'deploy/noa-app/jukebox/upload.js',
               'noa-browse-edit.js':'deploy/noa-browse-edit.js',
               'noa-browse.js':'deploy/noa-browse.js',
               'noa-app/jukebox/upload.css':'deploy/noa-app/jukebox/upload.css'}
release.NEW=set()
if __name__=='__main__':release.main()

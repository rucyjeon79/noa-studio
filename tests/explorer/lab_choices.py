"""The picker reads metadata; media verification runs only for a selected key."""
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as temp:
    site = Path(temp)
    (site / 'noa-bridge').mkdir()
    (site / 'noa-app/jukebox').mkdir(parents=True)
    shutil.copy(root / 'bridge/catalog.php', site / 'noa-bridge/catalog.php')
    db = sqlite3.connect(site / 'test.sqlite')
    db.execute('CREATE TABLE noa_documents(doc_key TEXT,kind TEXT,payload TEXT)')
    for key in ['single:one', 'single:two']:
        db.execute('INSERT INTO noa_documents VALUES(?,?,?)', (key, 'single', json.dumps({'title': key, 'genreId': 'kpop-original', 'ep': '40', 'body': {}})))
    db.commit()
    (site / 'common.php').write_text("<?php $is_member=getenv('ROLE')!=='guest';$is_admin=$is_member?'super':'';$_GET=['view'=>getenv('VIEW'),'key'=>getenv('KEY')];")
    (site / 'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo(){return new PDO('sqlite:" + str(site / 'test.sqlite') + "');}")
    (site / 'noa-bridge/sound-core.php').write_text("""<?php
    function noa_sound_trash_index($db){return ['ids'=>[]];}
    function noa_sound_visible($d,$admin){return empty($d['_noaTrash']);}
    function noa_sound_suno($b){return '';}
    function noa_sound_audio($b,$root){throw new RuntimeException('unexpected_media_fallback');}
    """)
    (site / 'noa-app/jukebox/core.php').write_text("""<?php
    function nj_assets($db){if(getenv('VIEW')==='labChoices')throw new RuntimeException('picker_must_not_read_media');return [];}
    function nj_resolve($assets,$key,$suno,$kind){return 'verified:'.$key;}
    """)
    import os
    def run(view, key='', role='admin'):
        result = subprocess.run(['php', str(site / 'noa-bridge/catalog.php')], env={**os.environ, 'VIEW': view, 'KEY': key, 'ROLE': role}, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    choices = run('labChoices')['items']
    assert [row['key'] for row in choices] == ['single:one', 'single:two']
    assert all('audioUrl' not in row for row in choices)
    assert run('labMedia', 'single:two') == {'key': 'single:two', 'audioUrl': 'verified:single:two'}
    assert run('labMedia', 'single:missing')['error'] == 'song_unavailable'
    assert run('labMedia', 'single:one', 'guest')['error'] == 'admin_required'
    assert run('labMedia', '../invalid')['error'] == 'invalid_key'
print('N80_LAB_METADATA_AND_SELECTED_MEDIA_OK')

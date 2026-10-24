"""Exercise the actual playlist PHP endpoint against disposable loopback MySQL.

Run only in an isolated Actions MySQL service:
  NOA_PLAYLIST_TEST_MYSQL=1 python tests/playlists/native_mysql_test.py
No production bootstrap, account, database, media, or session is used.
"""
import base64
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
CHANNEL = 'UCwYy9xsAqDFat6AV5UKrfgA'


def encoded(value):
    return base64.b64encode(json.dumps(value).encode()).decode()


class NativePlaylistAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('NOA_PLAYLIST_TEST_MYSQL') != '1':
            raise RuntimeError('explicit isolated MySQL test environment required')
        host = os.environ.get('NOA_PLAYLIST_TEST_HOST', '127.0.0.1')
        if host != '127.0.0.1':
            raise RuntimeError('playlist tests accept loopback MySQL only')
        port = int(os.environ.get('NOA_PLAYLIST_TEST_PORT', '3306'))
        if not 1 <= port <= 65535:
            raise RuntimeError('invalid isolated MySQL port')
        cls.database = 'noa_playlist_test_' + secrets.token_hex(6)
        cls.mysql = {'dsn': f'mysql:host={host};port={port};charset=utf8mb4',
                     'user': os.environ.get('NOA_PLAYLIST_TEST_USER', 'root'),
                     'password': os.environ.get('NOA_PLAYLIST_TEST_PASSWORD', 'jukebox-test-only')}
        cls.directory = tempfile.TemporaryDirectory(prefix='noa-playlist-http-')
        cls.root = Path(cls.directory.name)
        (cls.root / 'noa-bridge').mkdir()
        bootstrap = "$c=json_decode(base64_decode('" + encoded(cls.mysql) + "'),true);$db=new PDO($c['dsn'],$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);"
        cls.bootstrap = bootstrap
        schema = [
            'CREATE TABLE noa_documents(doc_key VARCHAR(190) PRIMARY KEY,kind VARCHAR(32) NOT NULL,payload LONGTEXT NOT NULL)',
            'CREATE TABLE noa_user_playlists(owner_id VARCHAR(64),playlist_id CHAR(36),title VARCHAR(160),tracks LONGTEXT,revision INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(owner_id,playlist_id))',
            'CREATE TABLE noa_catalog_batches(batch_id CHAR(64) PRIMARY KEY,status VARCHAR(16),applied_at TIMESTAMP)',
            'CREATE TABLE noa_catalog_songs(song_id CHAR(64) PRIMARY KEY,identity_json LONGTEXT,genre_id VARCHAR(64),ep VARCHAR(10))',
            'CREATE TABLE noa_catalog_versions(batch_id CHAR(64),entity_id CHAR(64),entity_type VARCHAR(16),fields_json LONGTEXT,public_verified TINYINT,PRIMARY KEY(batch_id,entity_id,entity_type))',
        ]
        sql = ['CREATE DATABASE ' + cls.database, 'USE ' + cls.database] + schema
        cls.run_php("foreach(json_decode(base64_decode('" + encoded(sql) + "'),true) as $sql)$db->exec($sql);")
        cls.run_php("$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');foreach(json_decode(base64_decode('" + encoded([
            ['single:kpop-original:01', 'single', json.dumps({'title': 'public', 'visibility': 'public'})],
            ['single:kpop-original:02', 'single', json.dumps({'title': 'private', 'visibility': 'private'})],
            ['story:fixture:01', 'story', json.dumps({'title': 'story', 'visibility': 'public'})],
        ]) + "'),true) as $row)$q->execute($row);")
        catalog = []
        for letter, public, privacy, channel in [('a', 1, 'public', CHANNEL), ('b', 0, 'private', CHANNEL), ('c', 1, 'private', CHANNEL), ('d', 1, 'public', 'wrong-owner-channel')]:
            catalog.append({'id': letter * 64, 'identity': ['song', 'youtube', channel, 'abcdefghijk'], 'public': public, 'fields': {'title': letter, 'privacyStatus': privacy}})
        cls.run_php("$db->exec(\"INSERT INTO noa_catalog_batches VALUES('" + 'f' * 64 + "','applied',NOW())\");$s=$db->prepare('INSERT INTO noa_catalog_songs VALUES(?,?,?,?)');$v=$db->prepare(\"INSERT INTO noa_catalog_versions VALUES(?,?,'song',?,?)\");foreach(json_decode(base64_decode('" + encoded(catalog) + "'),true) as $r){$s->execute([$r['id'],json_encode($r['identity']),'your-story','']);$v->execute(['" + 'f' * 64 + "',$r['id'],json_encode($r['fields']),$r['public']]);}")
        (cls.root / 'common.php').write_text("<?php define('_GNUBOARD_',true);session_start();$u=$_SERVER['HTTP_X_TEST_USER']??'guest';$is_member=in_array($u,['alice','bob','admin'],true);$member=['mb_id'=>$is_member?$u:''];$is_admin=$u==='admin'?'super':'';$_SESSION['noa_playlist_token']='fixture-csrf';")
        config = cls.mysql | {'dsn': cls.mysql['dsn'] + ';dbname=' + cls.database}
        (cls.root / 'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo():PDO{$c=json_decode(base64_decode('" + encoded(config) + "'),true);return new PDO($c['dsn'],$c['user'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);}")
        for name in ['user-playlists.php', 'sound-core.php']:
            (cls.root / 'noa-bridge' / name).write_bytes((ROOT / 'bridge' / name).read_bytes())
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0)); cls.port = sock.getsockname()[1]
        cls.server = subprocess.Popen(['php', '-S', f'127.0.0.1:{cls.port}', '-t', str(cls.root)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                cls.request('GET', user='guest')
                break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('isolated PHP fixture did not start')

    @classmethod
    def run_php(cls, code):
        selected = "" if code.startswith('foreach(json_decode') else "$db->exec('USE " + cls.database + "');"
        script = cls.root / 'database-fixture.php'
        script.write_text('<?php ' + cls.bootstrap + selected + code)
        subprocess.run(['php', str(script)], check=True, stdout=subprocess.DEVNULL)

    @classmethod
    def request(cls, method, body=None, user='alice', token='fixture-csrf', origin='https://noastudio.ai.kr'):
        headers = {'X-Test-User': user, 'Content-Type': 'application/json', 'Origin': origin}
        if token is not None: headers['X-NOA-CSRF'] = token
        request = urllib.request.Request(f'http://127.0.0.1:{cls.port}/noa-bridge/user-playlists.php', data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def playlist(self, tracks=None, user='alice'):
        playlist_id = str(uuid.uuid4())
        body = {'id': playlist_id, 'title': 'Disposable isolated playlist', 'tracks': tracks if tracks is not None else ['single:kpop-original:01'], 'expectedRevision': 0}
        status, result = self.request('POST', body, user=user)
        self.assertEqual(status, 200, result)
        return body, result

    def test_guest_and_delete_csrf_rejected(self):
        body, _ = self.playlist()
        deletion = {'id': body['id'], 'expectedRevision': 1}
        self.assertEqual(self.request('DELETE', deletion, user='guest')[0], 401)
        self.assertEqual(self.request('DELETE', deletion, token=None)[0], 403)
        self.assertEqual(self.request('DELETE', deletion, origin='https://wrong.example')[0], 403)

    def test_delete_is_owner_scoped_and_revision_checked(self):
        body, _ = self.playlist()
        deletion = {'id': body['id'], 'expectedRevision': 1}
        self.assertEqual(self.request('DELETE', deletion, user='bob')[0], 404)
        self.assertEqual(self.request('DELETE', deletion | {'expectedRevision': 0})[0], 409)
        status, result = self.request('DELETE', deletion)
        self.assertEqual(status, 200); self.assertTrue(result['deleted'])
        self.assertNotIn(body['id'], [item['playlist_id'] for item in self.request('GET')[1]['items']])
        self.assertEqual(self.request('DELETE', deletion)[0], 404)

    def test_post_delete_compatibility_retains_all_mutation_guards(self):
        body, _ = self.playlist()
        deletion = {'action': 'delete', 'id': body['id'], 'expectedRevision': 1}
        self.assertEqual(self.request('POST', deletion, user='guest')[0], 401)
        self.assertEqual(self.request('POST', deletion, token=None)[0], 403)
        self.assertEqual(self.request('POST', deletion, origin='https://wrong.example')[0], 403)
        self.assertEqual(self.request('POST', deletion, user='bob')[0], 404)
        self.assertEqual(self.request('POST', deletion | {'expectedRevision': 0})[0], 409)
        status, result = self.request('POST', deletion)
        self.assertEqual(status, 200); self.assertTrue(result['deleted'])
        self.assertEqual(self.request('POST', deletion)[0], 404)

    def test_owner_get_does_not_expose_other_accounts(self):
        body, _ = self.playlist(user='alice')
        self.assertNotIn(body['id'], [item['playlist_id'] for item in self.request('GET', user='bob')[1]['items']])

    def test_catalog_identity_and_public_visibility(self):
        self.playlist(['single:kpop-original:01', 'catalog:' + 'a' * 64])
        for key in ['catalog:' + letter * 64 for letter in 'bcde']:
            body = {'id': str(uuid.uuid4()), 'title': 'Rejected fixture', 'tracks': [key], 'expectedRevision': 0}
            self.assertEqual(self.request('POST', body)[0], 400, key)
        self.playlist(['catalog:' + 'b' * 64], user='admin')

    def test_private_legacy_document_and_shadow_cannot_be_bypassed(self):
        body = {'id': str(uuid.uuid4()), 'title': 'Rejected fixture', 'tracks': ['single:kpop-original:02'], 'expectedRevision': 0}
        self.assertEqual(self.request('POST', body)[0], 400)
        self.run_php("$q=$db->prepare('INSERT INTO noa_documents VALUES(?,?,?)');$q->execute(['catalog:" + 'a' * 64 + "','story','{\"visibility\":\"private\"}']);")
        try:
            self.assertEqual(self.request('POST', body | {'tracks': ['catalog:' + 'a' * 64]})[0], 400)
        finally:
            self.run_php("$q=$db->prepare('DELETE FROM noa_documents WHERE doc_key=?');$q->execute(['catalog:" + 'a' * 64 + "']);")

    def test_existing_save_replay_and_stale_revision(self):
        body, result = self.playlist()
        self.assertEqual(result['revision'], 1)
        status, replay = self.request('POST', body)
        self.assertEqual(status, 200); self.assertTrue(replay['replayed'])
        self.assertEqual(self.request('POST', body | {'title': 'stale change'})[0], 409)
        status, updated = self.request('POST', body | {'title': 'updated', 'expectedRevision': 1})
        self.assertEqual(status, 200); self.assertEqual(updated['revision'], 2)

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'server'):
            cls.server.terminate(); cls.server.wait(timeout=5)
        if hasattr(cls, 'root'):
            script = cls.root / 'cleanup.php'; script.write_text('<?php ' + cls.bootstrap + "$db->exec('DROP DATABASE " + cls.database + "');")
            subprocess.run(['php', str(script)], check=True, stdout=subprocess.DEVNULL)
        if hasattr(cls, 'directory'): cls.directory.cleanup()


if __name__ == '__main__':
    unittest.main(verbosity=2)

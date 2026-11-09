import base64
import hashlib
import io
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from noa_shorts_storage import MediaDrive, transfer, run_storage


class StorageTest(unittest.TestCase):
    def setUp(self):
        self.data = b'x' * 600
        self.asset = {'file': 'image.webp', 'bytes': 600, 'sha256': hashlib.sha256(self.data).hexdigest()}
        self.claim = {'id': 'a'*32, 'key': 'image:1:' + self.asset['sha256'], 'lease': 'lease',
                      'folderId': None, 'fileId': None, 'title': 'Song', 'parentFolderId': 'parentFolder111',
                      'sourceAudioSha256': 'b'*64, 'asset': {'kind': 'image', 'scene': 1, 'asset': self.asset}}
        self.calls = []; self.corrupt = False
        outer = self

        class Drive:
            def ids(self, count):
                return ['driveFolder111', 'driveFileId111'][-count:]

            def store(self, claim, source):
                outer.assertEqual(outer.calls[:2], ['storage_reserve', 'storage_read'])
                outer.assertEqual(source.read_bytes(), outer.data)
                return {'folderId': claim['folderId'], 'fileId': claim['fileId'],
                        **{k: outer.asset[k] for k in ('sha256', 'bytes')},
                        'readbackVerified': True, 'privateVerified': True}
        self.drive = Drive()

    def dispatch(self, command, **fields):
        self.calls.append(command)
        if command == 'storage_reserve':
            return {k: fields[k] for k in ('fileId', 'folderId')}
        if command == 'storage_read':
            return {'data': base64.b64encode(b'z'*600 if self.corrupt else self.data).decode(),
                    'offset': 0, 'nextOffset': 600, 'done': True, 'bytes': 600, 'sha256': self.asset['sha256']}
        if command == 'storage_complete':
            return {'state': 'stored', 'fileId': fields['receipt']['fileId']}
        if command == 'storage_fail':
            return {'state': 'failed'}
        raise AssertionError(command)

    def test_reserve_before_upload_and_reuse_ids(self):
        self.assertEqual(transfer(self.dispatch, self.claim, self.drive)['state'], 'stored')
        self.calls = []
        self.drive.ids = lambda _: self.fail('must reuse persisted Drive IDs')
        self.assertEqual(transfer(self.dispatch, self.claim, self.drive)['state'], 'stored')

    def test_corrupt_input_never_uploaded(self):
        self.corrupt = True
        self.drive.store = lambda *args: self.fail('corrupt bytes reached Drive')
        self.assertEqual(transfer(self.dispatch, self.claim, self.drive)['state'], 'storage_failed')
        self.assertNotIn('storage_complete', self.calls)
        self.assertEqual(self.calls[-1], 'storage_fail')

    def test_lost_upload_retains_ids(self):
        self.drive.store = lambda *args: (_ for _ in ()).throw(TimeoutError())
        self.assertEqual(transfer(self.dispatch, self.claim, self.drive)['state'], 'storage_failed')
        self.assertEqual(self.claim['fileId'], 'driveFileId111')
        self.assertNotIn('storage_complete', self.calls)

    def test_privacy_and_ownership(self):
        meta = {'id': 'fileId11111', 'parents': ['folder11111'], 'appProperties': {'n80_job': 'a'},
                'trashed': False, 'shared': False, 'ownedByMe': True}
        MediaDrive.verify(meta, 'fileId11111', 'folder11111', {'n80_job': 'a'})
        for bad in ({'shared': True}, {'ownedByMe': False}, {'trashed': True},
                    {'parents': ['unrelated']}, {'appProperties': {'n80_job': 'other'}}):
            with self.assertRaises(ValueError):
                MediaDrive.verify({**meta, **bad}, 'fileId11111', 'folder11111', {'n80_job': 'a'})

    def test_unknown_upload_url_rejected_before_credentials(self):
        drive = MediaDrive()
        drive.login.token = lambda: self.fail('credentials requested for unknown host')
        with self.assertRaises(ValueError):
            drive.open('https://example.com/upload', 'PUT', b'anything')

    def test_idle_worker_does_not_open_drive(self):
        class NoDrive:
            def ids(self, count):
                raise AssertionError('idle connection')
        self.assertEqual(run_storage(lambda _: {'claimed': False, 'state': 'no_generated_media'}, NoDrive()),
                         [{'state': 'no_generated_media'}])

    def test_existing_remote_after_lost_receipt_is_verified_without_upload(self):
        self.claim.update(folderId='driveFolder111', fileId='driveFileId111')
        drive = MediaDrive()
        drive.ensure_folder = lambda claim: None
        drive.metadata = lambda file_id: {
            'id': file_id, 'parents': ['driveFolder111'], 'trashed': False,
            'shared': False, 'ownedByMe': True, 'mimeType': 'image/webp',
            'size': '600', 'sha256Checksum': self.asset['sha256'],
            'appProperties': {'n80_job': self.claim['id'], 'n80_source': self.claim['sourceAudioSha256'],
                              'n80_asset': self.claim['key']}}
        def open_media(url, method='GET', *args):
            self.assertEqual(method, 'GET', 'lost receipt must not create another file')
            self.assertTrue(url.endswith('/driveFileId111?alt=media'))
            return io.BytesIO(self.data)
        drive.open = open_media
        result = drive.store(self.claim, Path('unused-local-file'))
        self.assertTrue(result['readbackVerified'])
        drive.open = lambda *args: io.BytesIO(b'z'*600)
        with self.assertRaisesRegex(ValueError, 'readback_checksum'):
            drive.store(self.claim, Path('unused-local-file'))


if __name__ == '__main__':
    unittest.main()

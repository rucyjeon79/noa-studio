import copy
from datetime import datetime, timezone
import hashlib
import io
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'lab'))
from daily_shorts import full_song, pages, prepare, rank_candidates, source_download

CHANNEL = 'UCtest'
P = {'channelId': CHANNEL, 'destinationPlaylistId': 'destination', 'destinationPlaylistTitle': 'Shorts「이 노래가 좋아」',
     'excludedPlaylistIds': ['kpoporiginal', 'destination', 'danceshorts'], 'genrePlaylistIds': {'genrelist': 'edm-kpop-club'}}


def video(vid, **kwargs):
    return {'id': vid, 'snippet': {'channelId': CHANNEL, 'title': 'KPOP Remix EP.1', 'publishedAt': '2025-01-01T00:00:00Z', **kwargs},
            'status': {'privacyStatus': 'public'}, 'contentDetails': {'duration': 'PT3M30S'}, 'statistics': {'viewCount': '100', 'likeCount': '9'}}


class Sftp:
    def __init__(self, data, regular=True):self.data, self.regular = data, regular
    def normalize(self, path):return path
    def lstat(self, path):return SimpleNamespace(st_mode=stat.S_IFREG if self.regular else stat.S_IFLNK, st_size=len(self.data))
    def open(self, path, mode):return io.BytesIO(self.data)


class PreparationTests(unittest.TestCase):
    def test_genre_remix_allowed_original_overlap_and_ambiguous_source_rejected(self):
        vids = [video('A'*11), video('B'*11), video('C'*11)]
        rows = [{'key': x, 'title': x, 'genre': 'edm-kpop-club', 'canonicalVideo': x*11} for x in 'ABC']
        members = {'genrelist': {'A'*11, 'B'*11, 'C'*11}, 'kpoporiginal': {'B'*11}}
        rows.append(dict(rows[2], key='duplicate'))
        out = rank_candidates(rows, vids, members, P, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.assertEqual([r['videoId'] for r in out], ['A'*11])
        self.assertIsNone(out[0]['recentAnalytics'])
        self.assertEqual(rank_candidates(rows, vids, members, P, ['A'*11]), [])

    def test_private_short_vertical_and_unknown_aspect_are_excluded(self):
        v = video('A'*11)
        v['status']['privacyStatus'] = 'private';self.assertFalse(full_song(v))
        v['status']['privacyStatus'] = 'public';v['contentDetails']['duration'] = 'PT2M'
        self.assertFalse(full_song(v))
        v['fileDetails'] = {'videoStreams': [{'widthPixels': 720, 'heightPixels': 1280}]};self.assertFalse(full_song(v))
        v['fileDetails']['videoStreams'][0] = {'widthPixels': 1920, 'heightPixels': 1080};self.assertTrue(full_song(v))
        v['snippet']['title'] += ' #Shorts';self.assertFalse(full_song(v))

    def test_pagination_cannot_loop_or_silently_drop_second_page(self):
        def call(command, **q):return {'data': {'items': [q['pageToken'] or 'first'], **({'nextPageToken': 'next'} if not q['pageToken'] else {})}}
        self.assertEqual(pages(call, 'playlists'), ['first', 'next'])
        with self.assertRaisesRegex(ValueError, 'pagination_loop'):
            pages(lambda *a, **k: {'data': {'items': [], 'nextPageToken': 'same'}}, 'playlists')

    def test_source_hash_and_no_symlinks_or_path_escape(self):
        data = b'actual-owned-audio'
        source = {'audioPath': '/hosting/noastudio/noa-jukebox-private/media/song/source.mp3', 'audioSha256': hashlib.sha256(data).hexdigest()}
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / 'audio.mp3'
            source_download(Sftp(data), source, dest);self.assertEqual(dest.read_bytes(), data)
            with self.assertRaisesRegex(ValueError, 'checksum_mismatch'):source_download(Sftp(b'changed'), source, dest)
            with self.assertRaisesRegex(ValueError, 'file_rejected'):source_download(Sftp(data, False), source, dest)
            with self.assertRaisesRegex(ValueError, 'path_rejected'):source_download(Sftp(data), dict(source, audioPath='/hosting/noastudio/html/config.php'), dest)

    def test_prepare_runs_three_owned_sources_and_preserves_missing_analytics(self):
        data = b'owned-fixture';digest = hashlib.sha256(data).hexdigest()
        vids = [video(x*11) for x in 'ABC']
        lists = [{'id': p, 'snippet': {'title': P['destinationPlaylistTitle'] if p == 'destination' else p, 'channelId': CHANNEL}} for p in ['genrelist', *P['excludedPlaylistIds']]]
        rows = [{'key': x, 'title': x, 'genre': 'edm-kpop-club', 'canonicalVideo': x*11} for x in 'ABC']
        calls = []
        def call(command, **q):
            calls.append(command)
            if command == 'catalog':return {'items': rows}
            if command == 'source':return {'source': {'key': q['trackKey'], 'title': q['trackKey'], 'genre': 'edm-kpop-club', 'revision': 7, 'audioSha256': digest, 'audioPath': '/hosting/noastudio/html/noa-jukebox/song.mp3', 'duration': 210, 'lyrics': 'registered lyrics'}}
            resource = q['resource']
            if resource == 'analytics':raise RuntimeError('not_ready')
            if resource == 'playlists':return {'data': {'items': lists}}
            if resource == 'videos':return {'data': {'items': vids}}
            if resource == 'playlistItems':return {'data': {'items': [{'contentDetails': {'videoId': x*11}} for x in 'ABC'] if q['playlistId'] == 'genrelist' else []}}
            raise AssertionError(resource)
        def analyze(path, lyrics, lengths):
            self.assertEqual(Path(path).read_bytes(), data);self.assertEqual(lengths, [49, 55, 59])
            return {'duration': 210, 'alignmentVerified': False, 'candidates': [{'start': 20, 'end': 75, 'score': .7}]}
        result = prepare(call, P, Sftp(data), analyze)
        self.assertEqual(len(result['candidates']), 3)
        self.assertEqual(calls.count('source'), 3)
        for row in result['candidates']:
            self.assertEqual(row['sourceRevision'], 7);self.assertEqual(row['audioSha256'], digest)
            self.assertIsNone(row['recentAnalytics']);self.assertEqual(row['analyticsAvailability'], 'unavailable')
            self.assertNotIn('audioPath', row)


if __name__ == '__main__':unittest.main()

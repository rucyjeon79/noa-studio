"""Regression tests for the N80 Shorts source and measured-audio safety gates.

No provider calls, no user audio files, no uploads and no publication side effects.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'lab'))
from daily_shorts import validate_measured_audio, verify_source_identity


class ShortsSourceGuardTests(unittest.TestCase):
    def setUp(self):
        self.candidate = {
            'trackKey': 'single:pop-original:31',
            'genre': 'pop-original',
            'videoId': 'aBcDEfgHI12',
        }
        self.source = {
            'key': self.candidate['trackKey'],
            'genre': self.candidate['genre'],
            'videoId': self.candidate['videoId'],
            'revision': 8,
            'duration': 210.0,
            'audioSha256': 'a' * 64,
            'lyrics': '[Verse]\n정확한 원곡 가사',
        }
        self.measured = {
            'duration': 210.0,
            'alignmentVerified': False,
            'candidates': [{'start': 15.0, 'end': 70.0, 'score': 0.72}],
        }

    def test_accepts_exact_posted_song_and_measured_shorts_window(self):
        self.assertIsNone(verify_source_identity(self.source, self.candidate))
        self.assertIs(validate_measured_audio(self.source, self.measured), self.measured)

    def test_rejects_other_edition_video_even_with_same_song_key(self):
        self.source['videoId'] = 'abcdefghijk'
        with self.assertRaisesRegex(ValueError, 'source_video_id_mismatch'):
            verify_source_identity(self.source, self.candidate)

    def test_rejects_changed_track_and_genre(self):
        self.source['key'] = 'single:pop-original:32'
        with self.assertRaisesRegex(ValueError, 'source_identity_changed'):
            verify_source_identity(self.source, self.candidate)

    def test_rejects_missing_audio_hash_and_invalid_revision(self):
        self.source['audioSha256'] = ''
        with self.assertRaisesRegex(ValueError, 'source_audio_hash_invalid'):
            verify_source_identity(self.source, self.candidate)
        self.source['audioSha256'] = 'a' * 64
        self.source['revision'] = True
        with self.assertRaisesRegex(ValueError, 'source_revision_invalid'):
            verify_source_identity(self.source, self.candidate)

    def test_requires_source_lyrics(self):
        self.source['lyrics'] = ''
        with self.assertRaisesRegex(ValueError, 'source_lyrics_required'):
            verify_source_identity(self.source, self.candidate)

    def test_never_accepts_synthetic_lyric_timing_as_measured(self):
        self.measured['alignmentVerified'] = True
        with self.assertRaisesRegex(ValueError, 'vocal_alignment_not_verified'):
            validate_measured_audio(self.source, self.measured)

    def test_requires_real_49_to_59_second_window(self):
        self.measured['candidates'][0]['end'] = 60.0
        with self.assertRaisesRegex(ValueError, 'invalid_measured_window'):
            validate_measured_audio(self.source, self.measured)

    def test_rejects_out_of_bounds_and_nonfinite_windows(self):
        self.measured['candidates'][0]['start'] = 180.0
        self.measured['candidates'][0]['end'] = 235.0
        with self.assertRaisesRegex(ValueError, 'invalid_measured_window'):
            validate_measured_audio(self.source, self.measured)
        self.measured['candidates'][0].update(start=10.0, end=65.0, score=float('nan'))
        with self.assertRaisesRegex(ValueError, 'invalid_measured_window'):
            validate_measured_audio(self.source, self.measured)

    def test_rejects_invalid_audio_length_and_no_candidates(self):
        self.measured['duration'] = 150.0
        with self.assertRaisesRegex(ValueError, 'source_duration_mismatch'):
            validate_measured_audio(self.source, self.measured)
        self.measured['duration'] = 210.0
        self.measured['candidates'] = []
        with self.assertRaisesRegex(ValueError, 'measured_short_windows_required'):
            validate_measured_audio(self.source, self.measured)


if __name__ == '__main__':
    unittest.main()

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('subtitles', Path(__file__).parents[2] / 'lab/session-subtitles.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SubtitleAlignment(unittest.TestCase):
    def test_unusable_native_words_are_quarantined_without_invented_time(self):
        words = [self.word('별빛이', 2, 3), self.word('.', 3, 3), self.word('내려와', 3, 3),
                 self.word('오늘도', 6, 7), self.word('잘못', -1, 8)]
        usable, discarded = module.usable_recognized_words(words, 10)
        self.assertEqual(discarded, 2)
        self.assertEqual(usable, [words[0], words[3]])
        self.assertFalse(module.match_lyrics('별빛이 내려와\n오늘도 행복해', usable, 10)['ready'])

    def test_cli_failure_receipt_has_a_typed_reason_not_raw_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); audio = root / 'private-audio.mp3'; audio.write_bytes(b'not-the-expected-audio')
            manifest = root / 'manifest.json'; output = root / 'result.json'
            manifest.write_text(json.dumps({'audio': {'path': str(audio), 'sha256': '0'*64}, 'duration': 5, 'lyrics': '가사'}))
            result = subprocess.run([sys.executable, module.__file__, str(manifest), str(output)], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(output.read_text()), {'error': 'audio_checksum_mismatch', 'errorType': 'ValueError'})

    def test_production_directions_are_not_lyrics(self):
        lyrics = '[Chorus]\n(soft gayageum harmonics, female vocal)\n별빛이 내려와\n(I love you)\n(아~)'
        self.assertEqual(module.lyric_lines(lyrics), ['별빛이 내려와', '(I love you)', '(아~)'])

    def word(self, text, start, end, probability=.95):
        return dict(word=text, start=start, end=end, probability=probability)

    def test_repeated_chorus_and_instrumental_gap(self):
        lyrics = '[Intro]\n별빛이 내려와\n[Interlude]\n다시 웃어 봐\n[Chorus]\n별빛이 내려와'
        words = [self.word('별빛이', 2, 3), self.word('내려와', 3, 4),
                 self.word('다시', 12, 13), self.word('웃어', 13, 14), self.word('봐', 14, 15),
                 self.word('별빛이', 20, 21), self.word('내려와', 21, 22)]
        result = module.match_lyrics(lyrics, words, 30)
        self.assertTrue(result['ready'])
        self.assertEqual([(c['startMs'], c['endMs']) for c in result['cues']], [(2000, 4000), (12000, 15000), (20000, 22000)])
        self.assertEqual([c['text'] for c in result['cues']], ['별빛이 내려와', '다시 웃어 봐', '별빛이 내려와'])

    def test_missing_line_never_receives_invented_timing(self):
        result = module.match_lyrics('별빛이 내려와\n오늘도 행복해', [self.word('별빛이 내려와', 2, 4)], 10)
        self.assertFalse(result['ready'])
        self.assertFalse(result['complete'])
        self.assertEqual(len(result['cues']), 1)
        self.assertEqual(result['issues'][0]['reason'], 'voice_not_matched')

    def test_low_confidence_and_silence_are_reviewed(self):
        result = module.match_lyrics('별빛이 내려와', [self.word('별빛이', 2, 3, .1), self.word('내려와', 8, 9)], 10)
        self.assertFalse(result['ready'])
        self.assertEqual(result['cues'][0]['maxWordGapMs'], 5000)
        self.assertEqual(module.match_lyrics('별빛이 내려와', [], 10)['cues'], [])

    def test_invalid_timestamps_and_non_korean(self):
        for words in [[self.word('가사', -1, 2)], [self.word('가사', 1, float('nan'))], [self.word('가사', 1, 12)]]:
            with self.assertRaises(ValueError):
                module.match_lyrics('가사', words, 10)
        with self.assertRaisesRegex(ValueError, 'korean_lyrics_required'):
            module.match_lyrics('[Piano Solo]\nInstrumental', [], 10)


if __name__ == '__main__':
    unittest.main()

import unittest,tempfile,wave,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'lab'))
from analyze import analyze

class AudioAnalysisTests(unittest.TestCase):
 def test_measured_candidates_within_source_and_not_fake_vocal_times(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'beat.wav';rate=16000;t=np.arange(rate*80)/rate
   # Internal deterministic fixture only; never presented as the user's original music.
   signal=.2*np.sin(2*np.pi*220*t)*(np.mod(t,.5)<.08)
   with wave.open(str(path),'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes((signal*32767).astype('<i2').tobytes())
   result=analyze(path,'[Chorus]\n한 걸음 더\n한 걸음 더',[{'metrics':{'summary':{'views':None,'averageViewDuration':None}}}])
   self.assertTrue(60<=result['bpm']<=200)
   self.assertGreaterEqual(len(result['candidates']),3)
   self.assertFalse(result['alignmentVerified'])
   self.assertEqual(result['vocalSegments'],[])
   self.assertEqual(result['hooks'][0]['occurrences'],2)
   for c in result['candidates']:
    self.assertLessEqual(c['end']-c['start'],60.001);self.assertGreaterEqual(c['start'],0);self.assertLessEqual(c['end'],80.01)
 def test_silence_is_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'silence.wav'
   with wave.open(str(path),'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(16000);out.writeframes(b'\0'*(16000*2*3))
   with self.assertRaisesRegex(ValueError,'silent_audio'):analyze(path)
if __name__=='__main__':unittest.main()

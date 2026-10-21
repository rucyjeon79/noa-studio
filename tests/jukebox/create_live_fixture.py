"""Clearly labelled, original synthesized music for isolated live QA; not catalogue audio."""
import math,wave,array,subprocess,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp');root.mkdir(parents=True,exist_ok=True)
rate=44100;duration=64;chords=[(261.63,329.63,392),(220,261.63,329.63),(174.61,220,261.63),(196,246.94,293.66)]
samples=array.array('h')
for i in range(rate*duration):
 t=i/rate;chord=chords[int(t//4)%4];beat=t%.5;note=chord[int((t%4)//.5)%3]*(2 if int(t//.5)%4==3 else 1);env=min(1,beat/.01)*math.exp(-5*beat);pad=sum(math.sin(2*math.pi*f*t) for f in chord)/3
 x=.24*env*(math.sin(2*math.pi*note*t)+.2*math.sin(4*math.pi*note*t))+.11*pad
 fade=min(1,t/.1,(duration-t)/.4);left=max(-.9,min(.9,x*fade));right=max(-.9,min(.9,(x*.94+.015*math.sin(2*math.pi*chord[0]*t))*fade));samples.extend([int(left*32767),int(right*32767)])
wav=root/'noa-jukebox-synthetic-verification.wav'
with wave.open(str(wav),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(samples.tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','192k',str(root/'noa-jukebox-synthetic-verification.mp3')],check=True)
print('Synthetic QA fixtures only; never count as acquired catalogue recordings.')

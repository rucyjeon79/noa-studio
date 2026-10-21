"""Disposable synthetic fixture, never counted as an actual catalogue recording."""
import sys,json,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import noa_jukebox_worker as w
root=Path('/tmp/noa-jukebox-fixture');root.mkdir(exist_ok=True)
source=root/'uploaded.wav';output=root/'optimized.mp3'
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=4','-ac','2','-ar','48000','-c:a','pcm_s16le',str(source)],check=True)
before,correction,after=w.optimize(source,output)
w.Image.new('RGB',(32,32),'#ccb480').save(root/'cover.webp','WEBP')
(root/'analysis.json').write_text(json.dumps({'source_analysis':before,'correction':correction,'final_analysis':after,'audio_sha256':w.digest(output),'audio_bytes':output.stat().st_size}))

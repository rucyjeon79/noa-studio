"""Real media checks and regression for the CLI's documented artifact location."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

repo = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('movie_worker', repo/'lab/movie-worker.py')
worker = importlib.util.module_from_spec(spec); spec.loader.exec_module(worker)
real_run = subprocess.run
with tempfile.TemporaryDirectory(prefix='noa-movie-regression-') as root:
    root = Path(root); home = root/'account-client'; artifacts = home/'generated_images'/'session'; artifacts.mkdir(parents=True)
    fixture = root/'fixture.png'
    real_run(['ffmpeg','-v','error','-f','lavfi','-i','testsrc=size=128x128','-frames:v','1','-threads','1',str(fixture)],check=True)
    (artifacts/'older.png').write_bytes(fixture.read_bytes())
    def fake_codex(args, **kwargs):
        if args[0] != 'codex': return real_run(args, **kwargs)
        (artifacts/'new.png').write_bytes(fixture.read_bytes())
        Path(args[args.index('-o')+1]).write_text('Image created.')
        return subprocess.CompletedProcess(args,0,stderr='')
    with patch.dict(os.environ, {'CODEX_HOME':str(home)}), patch.object(worker.subprocess,'run',side_effect=fake_codex):
        found = worker.codex('test',root/'work',generate=True)
    assert found == artifacts/'new.png', 'Retrieve only the new CLI artifact outside cwd'
    source=root/'original.wav'; correct=root/'correct.m4a'; wrong=root/'wrong.m4a'
    real_run(['ffmpeg','-v','error','-f','lavfi','-i','aevalsrc=sin(2*PI*(220*t+30*t*t)):s=48000:d=6',str(source)],check=True)
    for target,start in [(correct,'2'),(wrong,'0')]:
        real_run(['ffmpeg','-v','error','-ss',start,'-i',str(source),'-t','3','-c:a','aac','-b:a','192k',str(target)],check=True)
    assert worker.audio_check(source,correct,{'start':2,'end':5},3)>.99
    try:worker.audio_check(source,wrong,{'start':2,'end':5},3)
    except RuntimeError as error:assert str(error)=='audio_verification_failed'
    else:raise AssertionError('Incorrect source-audio segment accepted')
print('CLI artifact retrieval and real original-audio window verification passed')

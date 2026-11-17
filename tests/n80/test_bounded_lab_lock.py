"""Actual lab store lock under local OS contention; no host or provider access."""
import fcntl
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

ROOT=Path(__file__).resolve().parents[2]


@unittest.skipUnless(shutil.which("php"),"native PHP required for OS lock contention")
class BoundedLabLockTest(unittest.TestCase):
    def test_contention_timeout_release_and_legacy_default(self):
        with tempfile.TemporaryDirectory(prefix="n80-lab-lock-") as temp:
            base=Path(temp);private=base/"noa-ai-lab";private.mkdir()
            web=base/"www";web.mkdir()
            state=private/"state.json";state.write_text('{"revision":0,"preserve":"original"}')
            code="""define('_GNUBOARD_',true);define('G5_PATH',$argv[1]);
require $argv[2];
try{lab_lock(function(&$s){$s['clockFixture']=true;},$argv[3]==='legacy'?null:750);echo 'stored';}
catch(DomainException $e){echo $e->getMessage();}
"""
            command=["php","-r",code,str(web),str(ROOT/"bridge/lab-core.php"),"bounded"]
            with open(private/"state.lock","w") as lock:
                fcntl.flock(lock,fcntl.LOCK_EX)
                before=state.read_bytes();start=time.monotonic()
                result=subprocess.run(command,capture_output=True,text=True,timeout=3,check=True)
                self.assertEqual(result.stdout,"storage_busy")
                self.assertLess(time.monotonic()-start,2.5)
                self.assertEqual(state.read_bytes(),before)
                fcntl.flock(lock,fcntl.LOCK_UN)
            result=subprocess.run(command,capture_output=True,text=True,timeout=3,check=True)
            self.assertEqual(result.stdout,"stored")
            data=json.loads(state.read_text())
            self.assertEqual(data,{"revision":1,"preserve":"original","clockFixture":True})
            command[-1]="legacy"
            self.assertEqual(subprocess.run(command,capture_output=True,text=True,timeout=3,check=True).stdout,"stored")
            self.assertEqual(json.loads(state.read_text())["revision"],2)


if __name__=="__main__":unittest.main()

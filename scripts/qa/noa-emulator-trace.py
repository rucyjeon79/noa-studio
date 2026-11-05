"""Record only emulator process diagnostics; never export emulator memory dumps."""
import os
from pathlib import Path
root=Path(os.environ['ANDROID_HOME'])/'emulator'
launcher=root/'emulator'
real=root/'emulator-noa-original'
launcher.rename(real)
launcher.write_text('''#!/usr/bin/env python3
import os,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent
out=Path(os.environ['GITHUB_WORKSPACE'])/'android'/'noa-emulator-host.log'
with out.open('ab',buffering=0) as log:
 p=subprocess.Popen([str(root/'emulator-noa-original'),*sys.argv[1:]],stdout=log,stderr=log)
 result=p.wait()
 log.write(('\\nNOA_EMULATOR_EXIT='+str(result)+'\\n').encode())
sys.exit(result if result>=0 else 128-result)
''')
launcher.chmod(0o755)

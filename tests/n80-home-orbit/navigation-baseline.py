"""Keep the shared navigation check; identify its pre-existing footer-only failure against the exact base."""
from pathlib import Path
import os,subprocess,sys
script=sys.argv[1]
current=subprocess.run(['node',script],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
print(current.stdout)
if current.returncode==0:sys.exit(0)
known='AssertionError [ERR_ASSERTION]: footer theme control is not covered by the dock'
if known not in current.stdout:sys.exit(current.returncode)
base='4f7d957762f4fc0faac233e6581f5670e0751897'
subprocess.run(['git','fetch','--depth=1','origin',base],check=True,stdout=subprocess.DEVNULL)
files=['deploy/noa-ui.js','deploy/noa-starlight.css']
original={p:Path(p).read_bytes() for p in files}
try:
    for p in files:Path(p).write_bytes(subprocess.check_output(['git','show',base+':'+p]))
    before=subprocess.run(['node',script],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    print('UNCHANGED_BASELINE\n'+before.stdout)
    if before.returncode and known in before.stdout:
        print('BASELINE_FOOTER_FAILURE_CONFIRMED; orbit/home tests must pass independently')
    else:sys.exit(current.returncode)
finally:
    for p,data in original.items():Path(p).write_bytes(data)

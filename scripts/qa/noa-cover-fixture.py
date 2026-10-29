import os,shutil
from pathlib import Path
root=Path(os.environ['RUNNER_TEMP'])/'noa-inline-edit-fixture'
for f in ['noa-record-form.js','noa-record-form.css','noa-browse-edit.js','noa-browse.js']:shutil.copyfile('deploy/'+f,root/f)
(root/'cover.html').write_text("""<!doctype html><meta charset="utf-8"><main id="editor"></main><script src="/noa-browse.js"></script><script src="/noa-record-form.js"></script><script src="/noa-browse-edit.js"></script><script>window.editor=NoaBrowseEdit.mount({host:document.getElementById('editor'),standalone:true});</script>""")

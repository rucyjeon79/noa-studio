"""Build a local/staging-only POINT ZONE theme package; never contacts host."""
from pathlib import Path
import shutil
import sys
import tempfile
import subprocess

root=Path(__file__).resolve().parents[2]
source=root/"deploy/busan/youngcart"
engine_files=["point-contract.php","checkout-readiness.php","native-cart.php","existing-points.php","existing-point-settlement.php","existing-point-order-store.php","pointzone-actions.php","pointzone-activities.php"]

def stage(dest):
    if dest.exists():
        raise RuntimeError("destination already exists")
    shutil.copytree(source/"theme/Busan_PointZone",dest)
    engine=dest/"lib/engine"
    engine.mkdir()
    for name in engine_files:
        shutil.copyfile(source/name,engine/name)
    for php in dest.rglob("*.php"):
        subprocess.run(["php","-l",str(php)],check=True)
    if sorted(p.name for p in engine.iterdir())!=sorted(engine_files):
        raise RuntimeError("unexpected engine package")
    print("BUSAN_POINTZONE_THEME_PACKAGE_OK")

if __name__=="__main__":
    if len(sys.argv)!=1:raise SystemExit("staging test only")
    with tempfile.TemporaryDirectory(prefix="busan-pointzone-") as tmp:
        stage(Path(tmp)/"Busan_PointZone")

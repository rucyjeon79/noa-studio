"""One N80 owner activates agent dependencies before the existing transport."""
import sys
import noa_ainoa_deploy as release

release.FILES = {"noa-app/engine/"+name: "deploy/noa-app/engine/"+name for name in (
    "agent-runtime.php", "song-generation.php", "creative.php")}
release.FILES["noa-gpt.php"] = "deploy/noa-gpt.php"
release.NEW = {"noa-app/engine/agent-runtime.php"}

if __name__ == "__main__":
    try:
        release.main()
    except Exception:
        if "rollback" not in sys.argv and release.BACKUP.exists():
            sys.argv.append("rollback")
            release.main()
        raise

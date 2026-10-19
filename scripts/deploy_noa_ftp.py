"""Upload NOA-owned PHP endpoints to Dothome via explicit FTP credentials.

Fail closed if any remote target already exists. Never touch GnuBoard or DB.
"""
import ftplib
import io
import os
from pathlib import Path

FILES = {
    "deploy/noa2.php": "noa2.php",
    "deploy/noa-library.php": "noa-library.php",
    "bridge/index.php": "noa-bridge/index.php",
    "bridge/library.php": "noa-bridge/library.php",
}

def main():
    host = os.environ["FTP_HOST"]
    user = os.environ["FTP_USER"]
    password = os.environ["FTP_PASSWORD"]
    root = os.environ.get("FTP_ROOT", "").strip()
    if not root or not root.startswith("/") or ".." in root.split("/"):
        raise RuntimeError("NOA_FTP_ROOT must be an absolute verified remote path")
    # Never downgrade to cleartext FTP: credentials must stay encrypted.
    with ftplib.FTP_TLS(timeout=30) as ftp:
        ftp.connect(host, 21)
        try:
            ftp.login(user, password)
        except ftplib.error_perm as exc:
            if "AUTH" in str(exc).upper():
                raise RuntimeError("Server does not support explicit FTPS (AUTH TLS). No credentials were sent. Ask host for SFTP/FTPS support; cleartext FTP is disabled.") from None
            raise
        ftp.prot_p()
        ftp.cwd(root)
        base = ftp.pwd()
        # Refuse to deploy into an unexpected directory.
        if not base.endswith("/html"):
            raise RuntimeError("Remote FTP root must end with /html")
        live = os.environ.get("NOA_DEPLOY_CONFIRM") == "DEPLOY"
        print("Mode:", "LIVE" if live else "CHECK ONLY")
        existing = set(ftp.nlst())
        bridge_exists = "noa-bridge" in {p.rsplit("/", 1)[-1] for p in existing}
        if live and not bridge_exists:
            ftp.mkd("noa-bridge")
        for local, remote in FILES.items():
            directory, filename = remote.rsplit("/", 1) if "/" in remote else ("", remote)
            if directory and not bridge_exists and not live:
                print("CHECK:", remote, "parent directory missing; would create on deploy")
                continue
            ftp.cwd(base + ("/" + directory if directory else ""))
            if filename in {p.rsplit("/", 1)[-1] for p in ftp.nlst()}:
                raise RuntimeError(f"Refusing to overwrite existing remote file: {remote}")
            # Upload under temporary name and rename after transfer.
            temp = filename + ".uploading"
            if temp in {p.rsplit("/", 1)[-1] for p in ftp.nlst()}:
                raise RuntimeError(f"Stale temporary upload exists: {temp}")
            if not live:
                print("CHECK: available target", remote)
                continue
            data = Path(local).read_bytes()
            ftp.storbinary("STOR " + temp, io.BytesIO(data))
            ftp.rename(temp, filename)
            print("Created", remote, "bytes", len(data))
        ftp.quit()

if __name__ == "__main__":
    main()

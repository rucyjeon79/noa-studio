"""Busan-only, read-only ledger diagnostics via existing pinned SSH.
No remote uploads, SQL writes, or host changes. If exec is denied, stop.
Never print raw stderr or unvalidated host responses.
"""
import hmac
import json
import os
from pathlib import Path
import shlex
import socket
import sys
import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration, fingerprint, PORT, ROOT

BASE = Path(__file__).resolve().parent

def run_php(transport, filename, limit):
    source = (BASE / filename).read_text(encoding="utf-8")
    if not source.startswith("<?php"):
        raise RuntimeError("invalid_php_source")
    with transport.open_session(timeout=15) as ch:
        ch.settimeout(45)
        ch.exec_command("php -r " + shlex.quote(source[len("<?php"):]))
        raw = ch.makefile("rb").read(limit + 1)
        if len(raw) > limit:
            raise RuntimeError("receipt_too_large")
        status = ch.recv_exit_status()
    try:
        result = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise RuntimeError("remote_cli_receipt_unavailable") from None
    if not isinstance(result, dict) or result.get("checkout_ready") is not False:
        raise RuntimeError("unexpected_receipt")
    return status, result

def main():
    host, user, password, pin = configuration(os.environ)
    output = Path("busan-ledger-audit-result")
    output.mkdir(exist_ok=True)
    with socket.create_connection((host, PORT), timeout=15) as sock:
        with paramiko.Transport(sock) as transport:
            transport.banner_timeout = 15
            transport.auth_timeout = 15
            transport.get_security_options().key_types = ("ssh-ed25519",)
            transport.start_client(timeout=20)
            if not hmac.compare_digest(fingerprint(transport.get_remote_server_key()), pin):
                raise RuntimeError("host_key_mismatch")
            transport.auth_password(user, password, fallback=False)
            if not transport.is_authenticated():
                raise RuntimeError("auth_failed")
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(20)
                if sftp.normalize(ROOT) != ROOT:
                    raise RuntimeError("root_mismatch")
            code, metadata = run_php(transport, "live_ledger_metadata_readonly.php", 180000)
            if code not in (0, 3) or metadata.get("status") != "metadata_collected":
                raise RuntimeError("metadata_unavailable")
            expected = {"g5_member", "g5_point", "yc5_cart", "yc5_item", "yc5_order", "yc5_category", "yc5_item_option"}
            tables = metadata.get("tables", {})
            if not isinstance(tables, dict) or not set(tables) <= expected:
                raise RuntimeError("unexpected_table_receipt")
            (output / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
            print("BUSAN_LEDGER_METADATA", json.dumps({
                "engines": {k: v.get("engine") for k, v in tables.items()},
                "blocker_count": len(metadata.get("blockers", [])),
                "checkout_ready": False,
            }))
            code, writers = run_php(transport, "point_writer_inventory_readonly.php", 2000000)
            if code != 0 or writers.get("status") != "candidate_inventory" or writers.get("coverage_complete") is not False:
                raise RuntimeError("writer_inventory_unavailable")
            (output / "writer-candidates.json").write_text(json.dumps(writers, indent=2, ensure_ascii=False))
            print("BUSAN_LEDGER_WRITER_CANDIDATES", json.dumps({
                "files_scanned": writers.get("files_scanned"),
                "candidate_count": len(writers.get("matches", [])),
                "errors": len(writers.get("errors", [])),
                "coverage_complete": False,
                "checkout_ready": False,
            }))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("BUSAN_LEDGER_AUDIT_BLOCKED", type(exc).__name__, file=sys.stderr)
        sys.exit(2)

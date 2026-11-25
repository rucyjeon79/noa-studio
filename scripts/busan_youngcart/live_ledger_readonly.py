"""Busan-only read-only diagnostics. Existing pinned SSH/SFTP connection.
No remote writes, no credentials or source bodies in receipts. CLI metadata
is independent of SFTP source discovery; do not bypass a refused CLI.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import socket
import stat
import sys
import time
import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration, fingerprint, PORT, ROOT

BASE = Path(__file__).resolve().parent
PATTERNS = {
    "native_point_function": re.compile(rb"\b(?:insert_point|delete_point|delete_point_by_id|get_point_sum|delete_expire_point|insert_use_point|delete_use_point)\s*\(", re.I),
    "point_table_reference": re.compile(rb"\b(?:g5_point|point_table|po_use_point|po_expired|po_expire_date|po_mb_point)\b", re.I),
    "member_balance_reference": re.compile(rb"\bmb_point\b", re.I),
    "gift_or_ai_candidate": re.compile(rb"(?:point[_-]?(?:gift|transfer|deduct|charge|refund)|(?:gift|transfer|deduct|charge|refund)[_-]?point)", re.I),
}
SKIP = {"data", "vendor", "node_modules", "cache", "backup", "backups", "uploads", "logs", "secrets", "private", "config", "install"}
SENSITIVE = re.compile(r"(?:^|[._-])(?:dbconfig|config|credentials|secret|token|password|key|auth)(?:[._-]|$)", re.I)
MAX_FILES = 180
MAX_BYTES = 12 * 1024 * 1024
MAX_FILE = 1024 * 1024

class AuditBlocked(Exception):
    pass

def run_php(transport):
    source = (BASE / "live_ledger_metadata_readonly.php").read_text(encoding="utf-8")
    if not source.startswith("<?php"):
        raise AuditBlocked("invalid_php_source")
    with transport.open_session(timeout=15) as ch:
        ch.settimeout(30)
        ch.exec_command("php -r " + shlex.quote(source[len("<?php"):]))
        raw = ch.makefile("rb").read(180001)
        if len(raw) > 180000:
            raise AuditBlocked("receipt_too_large")
        code = ch.recv_exit_status()
    try:
        metadata = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise AuditBlocked("remote_cli_receipt_unavailable") from None
    if not isinstance(metadata, dict) or metadata.get("checkout_ready") is not False:
        raise AuditBlocked("unexpected_receipt")
    if code not in (0, 3) or metadata.get("status") != "metadata_collected":
        raise AuditBlocked("metadata_unavailable")
    expected = {"g5_member", "g5_point", "yc5_cart", "yc5_item", "yc5_order", "yc5_category", "yc5_item_option"}
    tables = metadata.get("tables", {})
    if not isinstance(tables, dict) or not set(tables) <= expected:
        raise AuditBlocked("unexpected_table_receipt")
    return metadata

def inventory(sftp):
    hits, errors, omitted = [], [], []
    scanned = total = 0
    deadline = time.monotonic() + 70
    # Start with native point library and known application source areas.
    queue = ["extend", "busan-assistant", "lib", "bbs", "theme/Busan_PointZone", "theme/UXC_Flarumix", "adm", "shop", "plugin"]
    priority = ['lib/common.lib.php','bbs/point.php','bbs/write_update.php','bbs/write_comment_update.php','bbs/delete.php','bbs/delete_comment.php','bbs/login_check.php','bbs/register_form_update.php','adm/point_list.php','adm/point_update.php','adm/point_list_delete.php']
    visited = set()
    root_entries = sftp.listdir_attr(ROOT)
    root_files = [e for e in root_entries if stat.S_ISREG(e.st_mode) and e.filename.endswith(".php")]
    def inspect(rel, attr):
        nonlocal scanned, total
        if rel in visited:return
        visited.add(rel)
        if time.monotonic() >= deadline:
            omitted.append(rel);return
        name = PurePosixPath(rel).name
        if name.startswith(".") or SENSITIVE.search(name) or not re.search(r"\.(?:php[0-9]?|inc|phtml)$", name, re.I):
            return
        if attr.st_size > MAX_FILE or scanned >= MAX_FILES or total + attr.st_size > MAX_BYTES:
            omitted.append(rel); return
        try:
            with sftp.open(ROOT + "/" + rel, "rb") as f:
                body = f.read(MAX_FILE + 1)
            if len(body) > MAX_FILE or total + len(body) > MAX_BYTES:
                omitted.append(rel); return
            scanned += 1; total += len(body)
            matched = {}
            for kind, pattern in PATTERNS.items():
                offsets = {body.count(b"\n", 0, m.start()) + 1 for m in pattern.finditer(body)}
                if offsets:
                    matched[kind] = sorted(offsets)[:200]
            if matched:
                hits.append({"path":rel, "sha256":hashlib.sha256(body).hexdigest(), "matches":matched})
        except OSError:
            errors.append(rel)
    for rel in priority:
        if time.monotonic() >= deadline:break
        try:
            attr=sftp.lstat(ROOT+'/'+rel)
            if stat.S_ISREG(attr.st_mode) and sftp.normalize(ROOT+'/'+rel)==ROOT+'/'+rel:
                inspect(rel,attr)
        except OSError:errors.append(rel)
    for e in root_files:
        if time.monotonic() >= deadline:break
        inspect(e.filename,e)
    while queue:
        if scanned >= MAX_FILES or total >= MAX_BYTES or time.monotonic() >= deadline:
            omitted.extend(queue); break
        rel = queue.pop(0)
        try:
            attr = sftp.lstat(ROOT + "/" + rel)
            if not stat.S_ISDIR(attr.st_mode):
                omitted.append(rel); continue
            if sftp.normalize(ROOT + "/" + rel) != ROOT + "/" + rel:
                omitted.append(rel); continue
            entries = sftp.listdir_attr(ROOT + "/" + rel)
        except OSError:
            errors.append(rel); continue
        for e in sorted(entries,key=lambda x:x.filename):
            if time.monotonic() >= deadline:
                omitted.append(rel);break
            n = e.filename
            if n in {".",".."} or "/" in n or n.startswith(".") or n.lower() in SKIP or SENSITIVE.search(n):
                continue
            child = rel + "/" + n
            if stat.S_ISDIR(e.st_mode):
                queue.append(child)
            elif stat.S_ISREG(e.st_mode):
                inspect(child,e)
    return {"status":"candidate_inventory","files_scanned":scanned,"bytes_scanned":total,
            "matches":hits,"errors":errors,"omitted":omitted,
            "coverage_complete":False,"checkout_ready":False}

def main():
    stage = "configuration"
    try:
        host, user, password, pin = configuration(os.environ)
        output = Path("busan-ledger-audit-result")
        output.mkdir(exist_ok=True)
        stage = "tcp"
        with socket.create_connection((host, PORT), timeout=15) as sock:
            with paramiko.Transport(sock) as transport:
                stage = "host_key"
                transport.banner_timeout = 15
                transport.auth_timeout = 15
                transport.get_security_options().key_types = ("ssh-ed25519",)
                transport.start_client(timeout=20)
                if not hmac.compare_digest(fingerprint(transport.get_remote_server_key()), pin):
                    raise AuditBlocked("host_key_mismatch")
                stage = "authentication"
                transport.auth_password(user, password, fallback=False)
                if not transport.is_authenticated():
                    raise AuditBlocked("auth_failed")
                stage = "sftp_root"
                with paramiko.SFTPClient.from_transport(transport) as sftp:
                    sftp.get_channel().settimeout(20)
                    if sftp.normalize(ROOT) != ROOT:
                        raise AuditBlocked("root_mismatch")
                    print("BUSAN_LEDGER_SFTP_VERIFIED", flush=True)
                    stage = "sftp_inventory"
                    writers = inventory(sftp)
                    (output / "writer-candidates.json").write_text(json.dumps(writers, indent=2, ensure_ascii=False))
                    print("BUSAN_LEDGER_WRITER_CANDIDATES", json.dumps({
                        "files_scanned":writers["files_scanned"],
                        "candidate_count":len(writers["matches"]),
                        "errors":len(writers["errors"]),
                        "omitted":len(writers["omitted"]),
                        "native_library":any(x["path"]=="lib/common.lib.php" for x in writers["matches"]),
                        "priority_matches":[x["path"] for x in writers["matches"][:40]],
                        "coverage_complete":False,
                        "checkout_ready":False,
                    }), flush=True)
                stage = "cli_metadata"
                metadata = run_php(transport)
                (output / "metadata.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False))
                print("BUSAN_LEDGER_METADATA", json.dumps({
                    "engines":{k:v.get("engine") for k,v in metadata["tables"].items()},
                    "blocker_count":len(metadata.get("blockers",[])),
                    "checkout_ready":False,
                }), flush=True)
    except Exception as exc:
        reason = str(exc) if isinstance(exc, AuditBlocked) else type(exc).__name__
        print("BUSAN_LEDGER_AUDIT_BLOCKED", stage, reason, file=sys.stderr, flush=True)
        return 2
    return 0

if __name__ == "__main__":
    sys.exit(main())

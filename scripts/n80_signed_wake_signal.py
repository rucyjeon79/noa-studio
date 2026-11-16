#!/usr/bin/env python3
"""NOA N80: one bounded, signed clock signal; NEVER a business worker.

Activation requires explicit GitHub operator gates AND N80 host-side approval,
verified executor and a dedicated private HMAC key. No polling, no queue
claims, no retries, no media processing and no host process launch.
"""
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

URL = "https://noastudio.ai.kr/noa-bridge/n80-scheduled-wake.php"
WINDOW_SECONDS = 1200
MAX_RESPONSE_BYTES = 2048


class WakeDenied(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise WakeDenied("wake_redirect_forbidden")


def slot_for(now: dt.datetime) -> dict:
    if now.tzinfo is None or now.utcoffset() is None:
        raise WakeDenied("wake_timezone_required")
    local = now.astimezone(ZoneInfo("Asia/Seoul"))
    if local.isoweekday() not in (1, 3, 5):
        raise WakeDenied("wake_day_not_approved")
    for phase, hour in (("prepare", 8), ("publish", 12)):
        start = local.replace(hour=hour, minute=0, second=0, microsecond=0)
        lag = (local - start).total_seconds()
        if 0 <= lag <= WINDOW_SECONDS:
            return {"action": "scheduled_wake", "operation": "ai.daily_shorts_clock",
                    "phase": phase, "slot": local.strftime("%Y-%m-%d")}
    raise WakeDenied("wake_outside_approved_window")


def make_envelope(now: dt.datetime, key: str, nonce: str):
    if not isinstance(key, str) or not re.fullmatch(r"[a-f0-9]{64}", key):
        raise WakeDenied("dedicated_wake_key_not_configured")
    if not isinstance(nonce, str) or not re.fullmatch(r"[a-f0-9]{32}", nonce):
        raise WakeDenied("wake_nonce_invalid")
    payload = slot_for(now)
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > 512:
        raise WakeDenied("wake_payload_too_large")
    timestamp = str(int(now.timestamp()))
    signed = f"N80-HUB-1\n{hashlib.sha256(raw).hexdigest()}\n{timestamp}\n{nonce}"
    signature = hmac.new(key.encode("ascii"), signed.encode("ascii"), hashlib.sha256).hexdigest()
    headers = {"Content-Type": "application/json", "X-N80-Time": timestamp,
               "X-N80-Nonce": nonce, "X-N80-Signature": signature}
    return payload, raw, headers


def send_once(now: dt.datetime, env: dict, opener=None, nonce=None) -> dict:
    if env.get("GITHUB_EVENT_NAME") != "schedule":
        raise WakeDenied("github_schedule_event_required")
    if (env.get("N80_WAKE_ACTIVATED") != "true" or
            env.get("N80_HOSTING_APPROVAL_VERIFIED") != "true"):
        raise WakeDenied("signed_wake_activation_pending")
    payload, raw, headers = make_envelope(now, env.get("N80_SCHEDULED_WAKE_KEY", ""),
                                          nonce if nonce is not None else secrets.token_hex(16))
    request = urllib.request.Request(URL, data=raw, headers=headers, method="POST")
    opener = opener if opener is not None else urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=12) as response:
            status = int(response.status)
            received = response.read(MAX_RESPONSE_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError):
        raise WakeDenied("signed_wake_transport_unverified") from None
    if status not in (200, 202) or len(received) > MAX_RESPONSE_BYTES:
        raise WakeDenied("signed_wake_response_unverified")
    try:
        proof = json.loads(received)
    except (ValueError, UnicodeDecodeError):
        raise WakeDenied("signed_wake_response_invalid") from None
    expected_slot = payload["slot"] + "|" + payload["phase"]
    if (not isinstance(proof, dict) or proof.get("ok") is not True
            or proof.get("executionAllowed") is not False
            or proof.get("slot") != expected_slot
            or proof.get("state") not in ("signal_admitted_not_executed", "duplicate_signal")):
        raise WakeDenied("signed_wake_receipt_unverified")
    if (status == 202) != (proof["state"] == "signal_admitted_not_executed"):
        raise WakeDenied("signed_wake_status_receipt_mismatch")
    return {"ok": True, "state": proof["state"], "slot": expected_slot,
            "executionAllowed": False, "githubBusinessWork": False,
            "hostProcessStarted": False, "attempts": 1, "providerCalls": 0}


def main():
    try:
        result = send_once(dt.datetime.now(dt.timezone.utc), os.environ)
    except WakeDenied as exc:
        print("N80_SIGNED_WAKE_BLOCKED " + str(exc), file=sys.stderr)
        raise SystemExit(1) from None
    print("N80_SIGNED_WAKE_SIGNAL " + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()

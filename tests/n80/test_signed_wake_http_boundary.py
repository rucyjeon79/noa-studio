"""Real PHP wake entrypoint against an isolated loopback fixture only.

No production HTTP calls, no Dothome credentials, no approval changes, no
outside provider calls, no server jobs, and no GitHub-host execution.
The only state mutation is a synthetic wake ticket in a TemporaryDirectory.
"""
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
KEY = "a" * 64


def copy_actual_php_auth():
    source = (REPO / "deploy/noa-app/engine/hub.php").read_text(encoding="utf8")
    match = re.search(r"(?ms)^function n80_hub_auth\([^)]*\):bool \{.*?^\}", source)
    if not match:
        raise AssertionError("real_hub_auth_source_not_found")
    return match.group(0)


STUB = r"""<?php
declare(strict_types=1);
// Test-only provider-free functions. Everything is inside a temporary path.
function n80_hub_root():string { return dirname(__DIR__,3).'/private'; }
function n80_hub_directory(string $root):void {
    if (!is_dir($root)||is_link($root)) throw new RuntimeException('unsafe_fixture');
}
function n80_host_load_policy():array {
    return json_decode(file_get_contents(n80_hub_root().'/policy.json'),true,16,JSON_THROW_ON_ERROR);
}
function n80_hub_read(string $root,string $name,array $default=[]):array {
    $file=$root.'/'.$name;
    return is_file($file)?json_decode(file_get_contents($file),true,16,JSON_THROW_ON_ERROR):$default;
}
function n80_hub_write(string $root,string $name,array $data):void {
    file_put_contents($root.'/'.$name,json_encode($data,JSON_THROW_ON_ERROR));
}
function n80_hub_locked(string $root,callable $fn,int $waitMs=750):mixed {
    return $fn(); // The local PHP server is single-worker, never concurrent.
}
"""


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class SignedWakeHttpBoundaryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("php"):
            raise unittest.SkipTest("php_cli_not_available")
        cls.sandbox = tempfile.TemporaryDirectory(prefix="n80-wake-http-fixture-")
        cls.base = Path(cls.sandbox.name)
        cls.private = cls.base / "private"
        cls.web = cls.base / "www"
        cls.private.mkdir(mode=0o700)
        (cls.web / "noa-bridge").mkdir(parents=True)
        (cls.web / "noa-app/engine").mkdir(parents=True)
        shutil.copyfile(REPO / "deploy/noa-bridge/n80-scheduled-wake.php",
                        cls.web / "noa-bridge/n80-scheduled-wake.php")
        shutil.copyfile(REPO / "deploy/noa-app/engine/scheduled-wake.php",
                        cls.web / "noa-app/engine/scheduled-wake.php")
        (cls.web / "noa-app/engine/hub.php").write_text(
            STUB + "\n" + copy_actual_php_auth() + "\n", encoding="utf8")
        cls.listener = port()
        cls.log = open(cls.base / "php.log", "w", encoding="utf8")
        cls.process = subprocess.Popen(
            ["php", "-S", f"127.0.0.1:{cls.listener}", "-t", str(cls.web)],
            cwd=cls.base, stdout=cls.log, stderr=cls.log, start_new_session=True,
            env={k:v for k,v in os.environ.items() if k != "PHP_CLI_SERVER_WORKERS"})
        cls.base_url=f"http://127.0.0.1:{cls.listener}/noa-bridge/n80-scheduled-wake.php"
        try:
            for _ in range(80):
                if cls.process.poll() is not None:
                    raise AssertionError("php_fixture_server_stopped")
                try:
                    cls.fetch(method="GET")
                    break
                except urllib.error.URLError:
                    time.sleep(0.05)
            else:
                raise AssertionError("php_fixture_server_timeout")
        except BaseException:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        if getattr(cls,"process",None) is not None and cls.process.poll() is None:
            os.killpg(cls.process.pid,signal.SIGTERM)
            cls.process.wait(timeout=5)
        if getattr(cls,"log",None) is not None:
            cls.log.close()
        if getattr(cls,"sandbox",None) is not None:
            cls.sandbox.cleanup()

    def put_json(self,name,data):
        (self.private / name).write_text(json.dumps(data,separators=(",",":")),encoding="utf8")

    def setUp(self):
        for file in self.private.glob("*"):
            if file.is_file():
                file.unlink()
        self.put_json("policy.json", {
            "githubWakeActivated":False, "requiresHostingApproval":True,
            "n80BoundedExecutorVerified":False,
            "githubActionsRole":"scheduled_wake_signal_only",
            "githubWorkerDispatchAllowed":False,
            "githubBusinessExecutionAllowed":False,
            "hostResidentRunnerAllowed":False,
            "hostLegacyHeartbeatAllowed":False,
            "hostLegacyBatchExecuteAllowed":False,
        })

    def approved_fixture(self):
        self.put_json("policy.json", {
            "githubWakeActivated":True,"requiresHostingApproval":False,
            "n80BoundedExecutorVerified":True,
            "githubActionsRole":"scheduled_wake_signal_only",
            "githubWorkerDispatchAllowed":False,
            "githubBusinessExecutionAllowed":False,
            "hostResidentRunnerAllowed":False,
            "hostLegacyHeartbeatAllowed":False,
            "hostLegacyBatchExecuteAllowed":False,
        })
        self.put_json("control.json", {"stop":True,"paused":True,"activeOperations":[]})
        self.put_json("scheduled-wake-control.json", {
            "version":1,"enabled":True,"paused":False,"stop":False,
            "hostingApproved":True,"boundedExecutorVerified":True,
        })
        now=dt.datetime.now(ZoneInfo("Asia/Seoul"))
        (self.web / "noa-app/engine/daily-shorts.json").write_text(json.dumps({
            "version":2,"timezone":"Asia/Seoul","maxPerLocalDate":1,
            "mediaStorage":{"provider":"google_drive"},
            "publishIsoWeekdays":[now.isoweekday()],
            "prepareLocalTime":now.strftime("%H:%M"),
            "publishLocalTime":now.strftime("%H:%M"),
        }),encoding="utf8")
        (self.private / "scheduled-wake.key").write_text(KEY,encoding="ascii")
        (self.private / "scheduled-wake.key").chmod(0o600)
        return {"action":"scheduled_wake","operation":"ai.daily_shorts_clock",
                "phase":"prepare","slot":now.strftime("%Y-%m-%d")}

    @classmethod
    def fetch(cls,method="POST",raw=None,headers=None):
        request=urllib.request.Request(
            cls.base_url,
            data=raw if raw is not None else (b"{}" if method=="POST" else None),
            headers=headers or {"Content-Type":"application/json"},
            method=method)
        try:
            response=urllib.request.urlopen(request,timeout=3)
        except urllib.error.HTTPError as exc:
            response=exc
        with response:
            body=response.read(8192)
            return response.status,dict(response.headers),json.loads(body) if body else {}

    def signed(self,body,nonce=None,key=KEY):
        raw=json.dumps(body,separators=(",",":")).encode()
        nonce=nonce or ("b"*32)
        stamp=str(int(time.time()))
        message=("N80-HUB-1\n"+hashlib.sha256(raw).hexdigest()+"\n"+stamp+"\n"+nonce).encode()
        sig=hmac.new(key.encode(),message,hashlib.sha256).hexdigest()
        return raw,{
            "Content-Type":"application/json",
            "X-N80-Time":stamp,"X-N80-Nonce":nonce,"X-N80-Signature":sig,
        }

    def test_default_disabled_post_never_creates_ticket(self):
        status,headers,body=self.fetch()
        self.assertEqual((status,body["error"],body["executionAllowed"]),
                         (503,"wake_not_activated",False))
        self.assertEqual(headers.get("Retry-After"),"3600")
        self.assertEqual(sorted(x.name for x in self.private.iterdir()),["policy.json"])

    def test_non_post_methods_are_denied_first(self):
        for verb in ("GET","PUT"):
            with self.subTest(method=verb):
                status,headers,body=self.fetch(method=verb)
                self.assertEqual((status,body["error"]),(405,"wake_method_not_allowed"))
                self.assertEqual(headers.get("Allow"),"POST")

    def test_missing_and_invalid_key_denied_without_state_mutation(self):
        body=self.approved_fixture()
        raw,headers=self.signed(body)
        (self.private/"scheduled-wake.key").unlink()
        status,_,response=self.fetch(raw=raw,headers=headers)
        self.assertEqual((status,response["error"]),(503,"wake_key_not_configured"))
        (self.private/"scheduled-wake.key").write_text(KEY,encoding="ascii")
        (self.private/"scheduled-wake.key").chmod(0o644)
        status,_,response=self.fetch(raw=raw,headers=headers)
        self.assertEqual((status,response["error"]),(503,"wake_key_not_configured"))
        self.assertFalse((self.private/"scheduled-wakes.json").exists())

    def test_corrupt_signature_and_content_type_denied(self):
        body=self.approved_fixture()
        raw,headers=self.signed(body)
        invalid=dict(headers,**{"X-N80-Signature":"0"*64})
        self.assertEqual(self.fetch(raw=raw,headers=invalid)[0],401)
        self.assertEqual(self.fetch(raw=raw,headers=dict(headers,**{"Content-Type":"text/plain"}))[0],400)
        self.assertEqual(self.fetch(raw=b"x"*513,headers=headers)[0],400)
        self.assertFalse((self.private/"scheduled-wakes.json").exists())

    def test_valid_post_once_and_duplicate_slot_no_business_execution(self):
        body=self.approved_fixture()
        raw,headers=self.signed(body,nonce="b"*32)
        status,_,first=self.fetch(raw=raw,headers=headers)
        self.assertEqual((status,first["state"],first["executionAllowed"]),
                         (202,"signal_admitted_not_executed",False))
        second_raw,second_headers=self.signed(body,nonce="c"*32)
        status,_,second=self.fetch(raw=second_raw,headers=second_headers)
        self.assertEqual((status,second["state"]),(200,"duplicate_signal"))
        store=json.loads((self.private/"scheduled-wakes.json").read_text())
        self.assertEqual(len(store["slots"]),1)
        slot=next(iter(store["slots"].values()))
        self.assertFalse(slot["mediaCreated"])
        self.assertFalse(slot["youtubePublished"])
        self.assertFalse(slot["executionVerified"])
        self.assertFalse((self.private/"business-work.json").exists())

    def test_latched_emergency_stop_blocks_second_request(self):
        body=self.approved_fixture()
        control=json.loads((self.private/"scheduled-wake-control.json").read_text())
        control["stop"]=True
        self.put_json("scheduled-wake-control.json",control)
        raw,headers=self.signed(body)
        status,_,answer=self.fetch(raw=raw,headers=headers)
        self.assertEqual((status,answer["error"]),(409,"wake_one_shot_suspended"))
        self.assertFalse((self.private/"scheduled-wakes.json").exists())


    def test_malformed_json_with_valid_hmac_returns_bad_request(self):
        self.approved_fixture()
        raw=b'{"action":'
        stamp=str(int(time.time()))
        nonce="d"*32
        msg=("N80-HUB-1\n"+hashlib.sha256(raw).hexdigest()+"\n"+stamp+"\n"+nonce).encode()
        signature=hmac.new(KEY.encode(),msg,hashlib.sha256).hexdigest()
        headers={
            "Content-Type":"application/json","X-N80-Time":stamp,
            "X-N80-Nonce":nonce,"X-N80-Signature":signature,
        }
        code,_,result=self.fetch(raw=raw,headers=headers)
        self.assertEqual((code,result["error"],result["executionAllowed"]),
                         (400,"wake_request_invalid",False))
        self.assertFalse((self.private/"scheduled-wakes.json").exists())

    def test_replayed_signed_nonce_reports_conflict_without_second_ticket(self):
        body=self.approved_fixture()
        raw,headers=self.signed(body,nonce="e"*32)
        self.assertEqual(self.fetch(raw=raw,headers=headers)[0],202)
        code,_,reply=self.fetch(raw=raw,headers=headers)
        self.assertEqual((code,reply["error"],reply["executionAllowed"]),
                         (409,"wake_replay",False))
        store=json.loads((self.private/"scheduled-wakes.json").read_text())
        nonces=json.loads((self.private/"scheduled-wake-nonces.json").read_text())
        self.assertEqual((len(store["slots"]),len(nonces)),(1,1))


if __name__=="__main__":
    unittest.main()

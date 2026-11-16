"""Pure N80 signed-clock tests. No network or host-side business work."""
import datetime as dt
import hashlib
import hmac
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts"))
import n80_signed_wake_signal as sut

UTC=dt.timezone.utc
KEY="a"*64
ENABLED={"GITHUB_EVENT_NAME":"schedule","N80_WAKE_ACTIVATED":"true",
         "N80_HOSTING_APPROVAL_VERIFIED":"true","N80_SCHEDULED_WAKE_KEY":KEY}


class FakeResponse:
    def __init__(self,status,data):
        self.status,self.data=status,data
    def read(self,limit):
        assert limit==sut.MAX_RESPONSE_BYTES+1
        return self.data
    def __enter__(self):
        return self
    def __exit__(self,*_):
        return False


class Opener:
    def __init__(self,status=202,body=None):
        self.status,self.body=status,body
        self.calls=[]
    def open(self,request,timeout):
        self.calls.append((request,timeout))
        content=json.loads(request.data)
        default={"ok":True,"state":"signal_admitted_not_executed",
                 "executionAllowed":False,"slot":content["slot"]+"|"+content["phase"]}
        payload=default if self.body is None else self.body
        data=payload if isinstance(payload,bytes) else json.dumps(payload).encode()
        return FakeResponse(self.status,data)


class WakeSignalTest(unittest.TestCase):
    def setUp(self):
        self.prep=dt.datetime(2026,11,17,23,0,3,tzinfo=UTC)  # Wed 08:00 KST
        self.publish=dt.datetime(2026,11,18,3,0,3,tzinfo=UTC) # Wed 12:00 KST

    def test_monday_wednesday_friday_slots(self):
        self.assertEqual(sut.slot_for(self.prep)["slot"],"2026-11-18")
        self.assertEqual(sut.slot_for(self.prep)["phase"],"prepare")
        self.assertEqual(sut.slot_for(self.publish)["phase"],"publish")

    def test_unapproved_days_times_and_naive_dates_fail_closed(self):
        for when in (dt.datetime(2026,11,18,0,tzinfo=UTC),  # Wed 09:00 KST
                     dt.datetime(2026,11,18,23,tzinfo=UTC), # Thu 08:00 KST
                     dt.datetime(2026,11,18,3,21,tzinfo=UTC),
                     dt.datetime(2026,11,18,8)):
            with self.subTest(when=when),self.assertRaises(sut.WakeDenied):
                sut.slot_for(when)

    def test_inactive_hosting_or_manual_trigger_never_contacts_server(self):
        for key,value in (("N80_WAKE_ACTIVATED","false"),
                          ("N80_HOSTING_APPROVAL_VERIFIED","false"),
                          ("GITHUB_EVENT_NAME","workflow_dispatch")):
            with self.subTest(key=key):
                opener=Opener()
                with self.assertRaises(sut.WakeDenied):
                    sut.send_once(self.prep,dict(ENABLED,**{key:value}),opener,"b"*32)
                self.assertEqual(opener.calls,[])

    def test_missing_dedicated_key_never_contacts_server(self):
        opener=Opener()
        with self.assertRaisesRegex(sut.WakeDenied,"key_not_configured"):
            sut.send_once(self.prep,dict(ENABLED,N80_SCHEDULED_WAKE_KEY=""),opener,"b"*32)
        self.assertEqual(opener.calls,[])

    def test_one_hmac_post_exact_url_and_response(self):
        opener=Opener()
        result=sut.send_once(self.prep,ENABLED,opener,"b"*32)
        self.assertEqual((result["state"],result["attempts"],result["providerCalls"]),
                         ("signal_admitted_not_executed",1,0))
        self.assertEqual(len(opener.calls),1)
        req,timeout=opener.calls[0]
        self.assertEqual((req.full_url,req.get_method(),timeout),(sut.URL,"POST",12))
        h={k.lower():v for k,v in req.header_items()}
        self.assertEqual(h["content-type"],"application/json")
        msg="N80-HUB-1\n"+hashlib.sha256(req.data).hexdigest()+"\n"+h["x-n80-time"]+"\n"+h["x-n80-nonce"]
        self.assertEqual(h["x-n80-signature"],
                         hmac.new(KEY.encode(),msg.encode(),hashlib.sha256).hexdigest())

    def test_duplicate_signal_returns_without_retry(self):
        reply={"ok":True,"state":"duplicate_signal",
               "executionAllowed":False,"slot":"2026-11-18|prepare"}
        opener=Opener(200,reply)
        result=sut.send_once(self.prep,ENABLED,opener,"b"*32)
        self.assertEqual((result["state"],len(opener.calls)),("duplicate_signal",1))

    def test_bad_receipt_html_oversize_and_false_execution_fail_closed(self):
        examples=[
            (202,{"ok":True,"state":"signal_admitted_not_executed",
                  "executionAllowed":True,"slot":"2026-11-18|prepare"}),
            (202,{"ok":True,"state":"signal_admitted_not_executed",
                  "executionAllowed":False,"slot":"2026-11-18|publish"}),
            (200,{"ok":True,"state":"signal_admitted_not_executed",
                  "executionAllowed":False,"slot":"2026-11-18|prepare"}),
            (503,{"ok":False,"error":"wake_not_activated"}),
            (202,b"<html>wrong</html>"),
            (202,b"x"*2100),
        ]
        for code,payload in examples:
            with self.subTest(code=code,payload=str(payload)[:22]):
                opener=Opener(code,payload)
                with self.assertRaises(sut.WakeDenied):
                    sut.send_once(self.prep,ENABLED,opener,"b"*32)
                self.assertEqual(len(opener.calls),1)

    def test_http_redirects_refused(self):
        with self.assertRaisesRegex(sut.WakeDenied,"redirect_forbidden"):
            sut.NoRedirect().redirect_request(None,None,302,"Found",{},
                "https://example.invalid","https://noastudio.ai.kr")


if __name__=="__main__":
    unittest.main()

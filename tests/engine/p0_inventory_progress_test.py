"""An inventory must never reopen completed work, erase a blocker, or replace newer progress."""
import copy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
from noa_p0_progress import initial_changes,recovery_changes,FIELDS
ident='NOA-20261026-P0-01';evidence=[{'eventId':'n80-completion-'+'a'*64}]
stages=[('01','in_progress','audit stage','read audit','')]
base={'id':ident,'text':'original instruction','status':'pending'}
assert len(initial_changes({'instructions':[base]},stages))==1
for field,value in [('status','complete'),('status','needs_review'),('status','error'),('evidence',evidence),('lastActivityAt','2026-10-26T10:00:00Z'),('error','existing blocker'),('currentStage','user work')]:
 assert initial_changes({'instructions':[{**base,field:value}]},stages)==[]
old={**base,'status':'needs_review','currentStage':'verified deployment','lastSuccessfulStage':'proof checked','error':'external key missing','lastActivityAt':'before','evidence':evidence}
audited={**old,'status':'in_progress','currentStage':'audit stage','lastSuccessfulStage':'read audit','error':'','lastActivityAt':'audit'}
snapshot=lambda task:{'instructions':[task]}
changes=recovery_changes(snapshot(old),snapshot(audited),snapshot(audited));assert len(changes)==1
assert all(changes[0][k]==old[k]for k in FIELDS)
assert changes[0]['evidenceIds']==[evidence[0]['eventId']]
assert recovery_changes(snapshot(old),snapshot(audited),snapshot({**audited,'currentStage':'new user work'}))==[]
assert recovery_changes(snapshot({**old,'evidence':[]}),snapshot(audited),snapshot(audited))==[]
bad=copy.deepcopy(audited);bad['evidence']=[]
try:recovery_changes(snapshot(old),snapshot(bad),snapshot(bad));raise AssertionError('altered evidence accepted')
except RuntimeError:pass
print('P0_INVENTORY_PRESERVES_PROGRESS_BLOCKERS_EVIDENCE_AND_LATER_WORK')

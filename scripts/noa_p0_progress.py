"""Preserve task progress during inventory; recover one identified audit overwrite additively."""
import hashlib,json,stat
from pathlib import Path

FIELDS=('status','currentStage','lastSuccessfulStage','error')
AUDIT_REQUEST='NOA-20261026-P0-STAGES-50df78cecbc8'
REPAIR_REQUEST='NOA-20261026-P0-PRESERVE-PROGRESS-50df78cecbc8'
IDS={'NOA-20261026-P0-'+str(i).zfill(2) for i in range(1,8)}

def initial_changes(snapshot,stages):
    entries={x['id']:x for x in snapshot['instructions']}
    return [{'id':'NOA-20261026-P0-'+n,'status':status,'currentStage':stage,'lastSuccessfulStage':success,'error':error,'evidenceIds':[]}
            for n,status,stage,success,error in stages
            if (entry:=entries['NOA-20261026-P0-'+n]).get('status')=='pending'
            and not entry.get('lastActivityAt') and not entry.get('evidence')
            and not any(entry.get(k) for k in FIELDS[1:])]

def recovery_changes(before,audited,current):
    previous={x['id']:x for x in before['instructions']};observed={x['id']:x for x in audited['instructions']};latest={x['id']:x for x in current['instructions']}
    changes=[]
    for ident in sorted(IDS):
        old=previous.get(ident);written=observed.get(ident);now=latest.get(ident)
        if not old or not old.get('evidence') or not all(k in old for k in FIELDS):continue
        # Only undo the exact known audit result. Later work always wins.
        if now!=written or old==written:continue
        if old.get('evidence')!=written.get('evidence'):raise RuntimeError('audit_evidence_changed')
        changes.append({'id':ident,**{k:old[k] for k in FIELDS},'evidenceIds':[e['eventId'] for e in old['evidence']]})
    return changes

def restore():
    import paramiko
    from noa_full_inventory import connect
    from n80_workstate_sync import DIRECTORY,request,compact
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport)as s:
            s.get_channel().settimeout(30)
            with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(129).strip()
            if len(key)!=64:raise RuntimeError('invalid_worker_key')
            current=request(key,{'action':'read'})['state']
            receipt=current['requestReceipts'].get(AUDIT_REQUEST)
            if not receipt or REPAIR_REQUEST in current['requestReceipts']:
                print('P0_AUDIT_PROGRESS_RECOVERY_NOT_NEEDED');return
            def read(revision):
                event_id='n80-workstate-integration-finish-20261024-r'+str(revision)
                path=DIRECTORY+'/'+hashlib.sha256(event_id.encode()).hexdigest()+'.json'
                info=s.lstat(path)
                if not stat.S_ISREG(info.st_mode)or stat.S_IMODE(info.st_mode)!=0o600 or info.st_size>1048576 or s.normalize(path)!=path:raise RuntimeError('unsafe_history')
                with s.open(path,'rb')as f:record=json.loads(f.read(1048577))
                e=record['event'];state=e['workState']
                if e['id']!=event_id or e['type']!='work.state.revised' or e['source']!='work_control' or state['revision']!=revision or state['parentTaskId']!='integration-finish-20261024':raise RuntimeError('unexpected_history')
                return e,state
            event,audited=read(receipt['revision']);previous_event,before=read(receipt['revision']-1)
            if event['previousEventSha256']!=hashlib.sha256(compact(previous_event)).hexdigest():raise RuntimeError('history_chain_mismatch')
            if event['requestId']!=AUDIT_REQUEST:raise RuntimeError('audit_identity_mismatch')
    finally:transport.close()
    changes=recovery_changes(before,audited,current)
    if changes:
        payload={'action':'revise','request':{'requestId':REPAIR_REQUEST,'expectedRevision':current['revision'],'changes':[],'appendInstructions':[],'taskChanges':changes}}
        result=request(key,payload)
        assert result['readbackVerified'] and request(key,payload)['effect']=='work_state_already_recorded'
    final=request(key,{'action':'read'});latest={x['id']:x for x in final['state']['instructions']}
    assert final['state']['areas']==current['areas']
    for c in changes:assert all(latest[c['id']][k]==c[k] for k in FIELDS)
    unchanged={x['id']:x for x in current['instructions'] if x['id']not in {c['id']for c in changes}}
    assert all(latest[k]==v for k,v in unchanged.items())
    out=Path('p0-audit-proof');out.mkdir(exist_ok=True)
    result={'ok':True,'auditRequest':AUDIT_REQUEST,'restoredTasks':[c['id']for c in changes],'revision':final['state']['revision'],'historyPreserved':True,'evidencePreserved':True,'unrelatedInstructionsPreserved':True,'allAreasComplete':final['summary']['allAreasComplete']}
    (out/'progress-preservation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('P0_AUDIT_PROGRESS_PRESERVED',json.dumps(result))

if __name__=='__main__':restore()

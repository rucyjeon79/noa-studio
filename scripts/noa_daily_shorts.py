"""N80 Auto campaign tick; existing workflow owns the clock and concurrency."""
import json, sys
from pathlib import Path
from noa_n80_ai_worker import worker_key, signed_tick

def main():
    key=worker_key()
    def dispatch(command='', **fields):
        return signed_tick(key,'n80_daily_shorts_tick',json.dumps({'command':command,**fields},ensure_ascii=False).encode())
    result=dispatch()
    c=result['campaign']
    print('N80_DAILY_SHORTS',json.dumps({k:c.get(k) for k in ('state','lastTickAt','nextPreparationAt','nextPublicationAt','productionReady','conversationDependent','readiness')}),flush=True)
    claim=dispatch('claim_preparation')
    if not claim.get('claimed'):
        print('N80_SHORTS_PREPARATION',json.dumps({'state':claim['state']}),flush=True)
        return
    lease=claim['lease']
    def call(command,**fields):return dispatch(command,lease=lease,**fields)
    try:
        import paramiko
        from noa_full_inventory import connect
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lab'))
        from daily_shorts import prepare
        from analyze import analyze
        transport=connect()
        try:
            with paramiko.SFTPClient.from_transport(transport) as sftp:
                sftp.get_channel().settimeout(30)
                report=prepare(call,claim['policy'],sftp,analyze)
        finally:transport.close()
        saved=call('complete_preparation',report=report)
        print('N80_SHORTS_PREPARATION',json.dumps({'state':saved['state'],'candidateCount':saved['candidateCount'],'publicationReady':False}),flush=True)
    except Exception as error:
        import re
        reason=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z_]{1,100}',str(error)) else 'preparation_dependency_failed'
        try:call('fail_preparation',reason=reason)
        except Exception:pass
        # A Shorts/provider failure must not stop unrelated text/music operations.
        print('N80_SHORTS_PREPARATION',json.dumps({'state':'preparation_failed','reason':reason,'errorType':type(error).__name__}),flush=True)

if __name__=='__main__':
    main()

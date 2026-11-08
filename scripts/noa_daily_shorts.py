"""N80 Auto campaign tick; existing workflow owns the clock and concurrency."""
import json
from noa_n80_ai_worker import worker_key, signed_tick

def main():
    result=signed_tick(worker_key(),'n80_daily_shorts_tick')
    c=result['campaign']
    print('N80_DAILY_SHORTS',json.dumps({k:c.get(k) for k in ('state','lastTickAt','nextPreparationAt','nextPublicationAt','productionReady','conversationDependent','readiness')}),flush=True)

if __name__=='__main__':
    main()

"""Live ChatGPT decision proof with explicitly synthetic tools; no real song writes."""
import copy
import json
import time
from agent import Commander
from worker import complete


def main():
    task_id = 'a'*32
    state = {'sequence': 0, 'deadline': time.time()+420, 'checkpoint': {
        'plan': [], 'candidate': '', 'decisions': 0, 'observation': None}}
    proof = {'liveChatGPT': True, 'syntheticTools': True, 'productionWrites': 0, 'validations': 0}

    def api(op, body=None):
        if op.startswith('read&'):
            return {'ok': True, 'id': task_id, 'field': 'title',
                    'song': {'title': 'A Quiet Walk Under the Moon'},
                    'generationInstructions': 'Shorten the CURRENT English song title to at most 16 characters, retaining the word Moon. Return only the shortened title.'}
        if op == 'agentState':
            return {'ok': True, 'contract': {'version':1, 'module':'ai_lab', 'brain':'ChatGPT',
                    'maxDecisions':6, 'tools':['song.read','result.validate','result.save'], 'specialists':[]}, 'agent':copy.deepcopy(state)}
        if body['id'] != task_id: raise RuntimeError('probe_identity_changed')
        if op == 'agentCheckpoint':
            assert body['sequence'] == state['sequence']
            if body['checkpoint']['candidate'] != state['checkpoint']['candidate']: state.pop('validation',None)
            state['checkpoint'] = copy.deepcopy(body['checkpoint']);state['sequence'] += 1
        elif op == 'agentValidate':
            text = body['text'];proof['validations'] += 1
            valid = len(text) <= 16 and 'Moon' in text and text.strip() == text
            state['validation'] = {'valid':valid, 'errors':[] if valid else ['use_Moon_and_maximum_16_characters']}
            return {'ok':True,'validation':state['validation'],'agent':copy.deepcopy(state)}
        elif op == 'save':
            assert state['checkpoint']['plan'] and state['validation']['valid']
            assert body['text'] == state['checkpoint']['candidate']
            proof['syntheticSaveConfirmed'] = True
            return {'ok':True,'saved':True,'revision':2}
        else: raise RuntimeError('unexpected_probe_tool')
        return {'ok':True,'agent':copy.deepcopy(state)}

    result=Commander(task_id,api,complete).run()
    assert result['saved'] and proof.get('syntheticSaveConfirmed') and proof['validations']>=1
    proof['decisions']=result['decisions']
    print('N80_AGENT_LIVE_CHATGPT_PROOF', json.dumps(proof))


if __name__ == '__main__': main()

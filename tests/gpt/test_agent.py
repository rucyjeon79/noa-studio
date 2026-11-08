"""Exercise decisions, repair, scope boundaries and actual save receipts without inference."""
import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'integrations/private-worker'))
from agent import Commander, AgentStopped


class Host:
    def __init__(self):
        self.task = {'ok': True, 'id': 'a'*32, 'field': 'title', 'song': {'title': 'Current'}}
        self.state = {'sequence': 0, 'deadline': 1000, 'checkpoint': {
            'plan': [], 'candidate': '', 'decisions': 0, 'observation': None}}
        self.contract = {'version': 1, 'module': 'ai_lab', 'brain': 'ChatGPT', 'maxDecisions': 6, 'specialists': []}
        self.writes = []
        self.validations = []
        self.saved = True

    def api(self, op, body=None):
        if op.startswith('read&'): return copy.deepcopy(self.task)
        if op == 'agentState': return {'ok': True, 'contract': self.contract, 'agent': copy.deepcopy(self.state)}
        if op == 'agentCheckpoint':
            assert body['id'] == self.task['id'] and body['sequence'] == self.state['sequence']
            if body['checkpoint']['candidate'] != self.state['checkpoint']['candidate']:
                self.state.pop('validation', None)
            self.state['checkpoint'] = copy.deepcopy(body['checkpoint'])
            self.state['sequence'] += 1
        elif op == 'agentValidate':
            self.validations.append(body['text'])
            self.state['validation'] = {'valid': body['text'] != 'bad', 'errors': ['invalid_text'] if body['text'] == 'bad' else []}
            return {'ok': True, 'validation': self.state['validation'], 'agent': copy.deepcopy(self.state)}
        elif op == 'save':
            assert self.state['validation']['valid'] and body['text'] == self.state['checkpoint']['candidate']
            self.writes.append(body)
            return {'ok': True, 'saved': self.saved, 'revision': 7}
        else: raise AssertionError(op)
        return {'ok': True, 'agent': copy.deepcopy(self.state)}


class AgentTests(unittest.TestCase):
    def run_script(self, host, actions, specialists=None):
        actions = iter(actions)
        def model(prompt, timeout):
            self.assertIn('REFERENCE_DATA_JSON', prompt)
            return json.dumps(next(actions))
        return Commander('a'*32, host.api, model, specialists, clock=lambda: 1).run()

    def draft(self, text): return {'action': 'draft', 'plan': ['Use current song', 'Review and save'], 'text': text}

    def test_repair_and_confirm_real_save(self):
        h=Host();result=self.run_script(h,[self.draft('bad'),self.draft('good'),{'action':'save'}])
        self.assertEqual(h.validations,['bad','good']);self.assertEqual(len(h.writes),1)
        self.assertEqual(result['revision'],7);self.assertEqual(result['decisions'],3)

    def test_unavailable_specialist_does_not_fake_output(self):
        h=Host();called=[]
        self.run_script(h,[{'action':'delegate','specialist':'video','instruction':'make it'},self.draft('direct'),{'action':'save'}],{'video':lambda *a:called.append(a)})
        self.assertFalse(called);self.assertEqual(h.writes[0]['text'],'direct')

    def test_registered_specialist_remains_under_commander_review(self):
        h=Host();h.contract['specialists']=[{'id':'review','connected':True}];called=[]
        def specialist(task, instruction): called.append(task['id']);return {'feedback':'keep current title'}
        self.run_script(h,[{'action':'delegate','specialist':'review','instruction':'review current title'},self.draft('Current'),{'action':'save'}],{'review':specialist})
        self.assertEqual(called,['a'*32]);self.assertEqual(h.writes[0]['text'],'Current')

    def test_no_save_without_candidate_or_validation(self):
        h=Host();self.run_script(h,[{'action':'save'},self.draft('good'),{'action':'save'}]);self.assertEqual(len(h.writes),1)

    def test_source_change_is_rejected(self):
        h=Host();h.task['id']='b'*32
        with self.assertRaisesRegex(AgentStopped,'task_identity_changed'): self.run_script(h,[])
        self.assertFalse(h.writes)

    def test_unconfirmed_receipt_is_not_success(self):
        h=Host();h.saved=False
        with self.assertRaisesRegex(AgentStopped,'save_not_confirmed'): self.run_script(h,[self.draft('good'),{'action':'save'}])

    def test_unknown_tools_and_budget(self):
        h=Host()
        with self.assertRaisesRegex(AgentStopped,'agent_decision_limit'): self.run_script(h,[{'action':'shell','command':'ignored'}]*6)
        self.assertEqual(h.state['checkpoint']['decisions'],6);self.assertFalse(h.writes)

    def test_checkpoint_resume_keeps_candidate_and_budget(self):
        h=Host();h.state['checkpoint'].update(plan=['Finish'],candidate='ready',decisions=4);h.state['validation']={'valid':True,'errors':[]}
        result=self.run_script(h,[{'action':'save'}]);self.assertEqual(result['decisions'],5);self.assertEqual(h.writes[0]['text'],'ready')

    def test_stopped_before_inference_after_deadline(self):
        h=Host();h.state['deadline']=2
        with self.assertRaisesRegex(AgentStopped,'agent_deadline'): self.run_script(h,[])
        self.assertEqual(h.state['checkpoint']['decisions'],0)

    def test_malformed_action_recovers(self):
        h=Host();answers=iter(['not JSON',json.dumps(self.draft('good')),json.dumps({'action':'save'})])
        result=Commander('a'*32,h.api,lambda *a,**k:next(answers),clock=lambda:1).run()
        self.assertTrue(result['saved']);self.assertEqual(result['decisions'],3)


if __name__ == '__main__': unittest.main()

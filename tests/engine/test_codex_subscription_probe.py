from pathlib import Path
import sys,tempfile,json,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts'))
import n80_codex_subscription_probe as p

class ProbeTests(unittest.TestCase):
    def fixture(self,events,result=None):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);root=Path(temp.name)
        (root/'result.json').write_text(json.dumps(result or {'text':'검증용 응답'}))
        (root/'events.jsonl').write_text('\n'.join(json.dumps(e) for e in events))
        return root
    def test_text_without_completion_is_not_success(self):
        with self.assertRaisesRegex(RuntimeError,'completion_event_unconfirmed'):p.parse_result(self.fixture([]))
    def test_tool_event_cannot_be_accepted_as_text_only(self):
        events=[{'type':'item.completed','item':{'type':'command_execution'}},{'type':'turn.completed','usage':{}}]
        with self.assertRaisesRegex(RuntimeError,'unexpected_tool_execution'):p.parse_result(self.fixture(events))
    def test_two_turns_cannot_be_reported_as_one(self):
        with self.assertRaisesRegex(RuntimeError,'completion_event_unconfirmed'):p.parse_result(self.fixture([{'type':'turn.completed'},{'type':'turn.completed'}]))
    def test_valid_result_keeps_real_usage(self):
        text,usage=p.parse_result(self.fixture([{'type':'turn.completed','usage':{'output_tokens':8}}]))
        self.assertEqual(text,'검증용 응답');self.assertEqual(usage['output_tokens'],8)
    def test_cli_keeps_subscription_and_read_only_limits(self):
        args=p.command(Path('/official/codex'),Path('/private/job'),'gpt-6.1-sol')
        self.assertIn('forced_login_method="chatgpt"',args);self.assertIn('--ignore-user-config',args)
        self.assertEqual(args[args.index('--sandbox')+1],'read-only')
        self.assertNotIn('--dangerously-bypass-approvals-and-sandbox',args)

if __name__=='__main__':unittest.main()

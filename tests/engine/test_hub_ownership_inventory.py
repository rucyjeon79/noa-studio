"""Keep migrated functional ownership separate from execution-location cutover evidence."""
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('inventory',ROOT/'scripts/n80_hub_inventory.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OwnershipInventory(unittest.TestCase):
 def test_every_existing_auto_operation_has_one_specialized_owner(self):
  auto=json.loads((ROOT/'config/n80-automation.json').read_text())['operations']
  for row in m.inventory()['workflows']:
   self.assertEqual(row['modules'],sorted({auto[op]['module'] for op in row['operations']}))
   self.assertEqual(row['sourceCustodian'],'hub')
  for row in m.inventory()['remaining']:
   self.assertIn(row['module'],['media','lab','install','hub'])
   self.assertTrue(row['reason'])
 def test_processing_and_playback_stay_distinct(self):
  auto=json.loads((ROOT/'config/n80-automation.json').read_text())['operations']
  self.assertEqual(auto['jukebox.process']['module'],'media')
  self.assertEqual(auto['jukebox.watchdog']['module'],'jukebox')
  self.assertEqual(auto['engine.integrity']['module'],'guard')
  self.assertEqual(auto['notifications.dispatch']['module'],'notify')
 def test_hub_schedule_keeps_existing_nine_operations(self):
  rows=json.loads((ROOT/'config/n80-hub-operations.json').read_text())
  self.assertEqual(set(rows),{'hub.verify','ai.text','ai.batch','catalog.index','notifications.dispatch','popularity.calculate','members.maintain','ai.daily_shorts_clock','covers.refresh'})
  self.assertEqual(rows['notifications.dispatch']['interval'],60)
if __name__=='__main__':unittest.main()

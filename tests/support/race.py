import subprocess,json
workers=[subprocess.Popen(['php','tests/support/race-worker.php'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(8)]
receipts=[]
for p in workers:
 out,err=p.communicate(timeout=45)
 assert p.returncode==0,err
 receipts.append(json.loads(out))
assert all(r==receipts[0] for r in receipts)
check=subprocess.check_output(['php','-r',"require 'tests/subscription/native_fixture.php';require 'bridge/support-core.php';echo json_encode([get_point_sum('s_race'),nsp_count('song:race')]);"],text=True)
assert json.loads(check)==[9000,1],check
print('SUPPORT_EIGHT_CONCURRENT_REQUESTS_ONE_DEBIT_OK')

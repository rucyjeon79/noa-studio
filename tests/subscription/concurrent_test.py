import concurrent.futures,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
def buy(user,key):
 r=subprocess.run(['php','tests/subscription/concurrent.php',user,key],cwd=root,capture_output=True,text=True,check=True);return json.loads(r.stdout)
a='77777777-7777-4777-8777-777777777777';b='88888888-8888-4888-8888-888888888888';c='99999999-9999-4999-8999-999999999999'
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
 results=list(pool.map(lambda key:buy('race',key),[a,b]))
assert sum(r['ok']for r in results)==1,results
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
 results=list(pool.map(lambda key:buy('idem',key),[c,c]))
assert all(r['ok']for r in results),results
code="require 'tests/subscription/native_fixture.php';echo json_encode(['race'=>get_point_sum('race'),'idem'=>get_point_sum('idem'),'receipts'=>(int)ns_one(\"SELECT COUNT(*) AS n FROM g5_point WHERE mb_id IN ('race','idem') AND po_rel_table='noa_subscription'\")['n']]);"
r=json.loads(subprocess.check_output(['php','-r',code],cwd=root,text=True));assert r=={'race':0,'idem':0,'receipts':2},r
print('CONCURRENT_POINTS_EXACTLY_ONCE_AND_NO_OVERDRAFT_OK')

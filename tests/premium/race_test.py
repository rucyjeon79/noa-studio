import concurrent.futures,json,subprocess

def buy(user,key):return json.loads(subprocess.check_output(['php','tests/premium/concurrent.php',user,key],text=True))
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as p:
 r=list(p.map(lambda x:buy('race_dl',x),['aaaabbbb-1111-4111-8111-111111111111','aaaacccc-1111-4111-8111-111111111111']))
assert sum(x['ok']for x in r)==1,r
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as p:
 r=list(p.map(lambda x:buy('idem_dl',x),['aaaadddd-1111-4111-8111-111111111111']*2))
assert all(x['ok']for x in r),r
code="require 'tests/subscription/native_fixture.php';echo json_encode(['race'=>get_point_sum('race_dl'),'idem'=>get_point_sum('idem_dl'),'owner'=>get_point_sum('owner'),'receipts'=>(int)ns_one(\"SELECT COUNT(*) AS n FROM g5_point WHERE po_rel_table='noa_music_download'\")['n']]);"
r=json.loads(subprocess.check_output(['php','-r',code],text=True));assert r=={'race':0,'idem':0,'owner':1500,'receipts':6},r
print('PREMIUM_CONCURRENT_NO_OVERDRAFT_AND_EXACT_OWNER_SHARE_OK')

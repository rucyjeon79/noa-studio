import concurrent.futures,json,subprocess
def run(i):return json.loads(subprocess.check_output(['php','tests/payments/concurrent.php'],text=True))
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool: rows=list(pool.map(run,range(8)))
assert all(r['state']=='paid' for r in rows)
code="require 'tests/subscription/native_fixture.php';echo json_encode(['balance'=>get_point_sum('tp_race'),'credits'=>(int)ns_one(\"SELECT COUNT(*) AS n FROM g5_point WHERE mb_id='tp_race' AND po_rel_table='noa_toss'\")['n']]);"
r=json.loads(subprocess.check_output(['php','-r',code],text=True));assert r=={'balance':11000,'credits':2},r
print('TOSS_CONCURRENT_CALLBACKS_EXACTLY_ONCE_OK')

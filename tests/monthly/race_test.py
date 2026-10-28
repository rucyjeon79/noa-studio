import concurrent.futures,json,subprocess

def run(kind,i):return json.loads(subprocess.check_output(['php','tests/monthly/concurrent.php',kind,str(i)],text=True))
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:
    rows=list(pool.map(lambda i:run('activity',i),range(1,9)))
assert sorted(r['points']for r in rows)==[50]*7+[500],rows
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
    rows=list(pool.map(lambda i:run('like',i),[1,1,2,2]))
code="require 'tests/subscription/native_fixture.php';echo json_encode(['activity'=>get_point_sum('month_race'),'like'=>get_point_sum('month_like_race'),'loginCredits'=>(int)ns_one(\"SELECT COUNT(*) AS n FROM g5_point WHERE mb_id='month_race' AND po_rel_table='noa_monthly'\")['n']]);"
r=json.loads(subprocess.check_output(['php','-r',code],text=True));assert r=={'activity':1850,'like':110,'loginCredits':1},r
print('MONTHLY_CONCURRENT_LOGIN_WRITE_LIKE_EXACTLY_ONCE_OK')

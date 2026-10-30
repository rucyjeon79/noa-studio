import subprocess,json
setup="require 'tests/subscription/native_fixture.php'; ns_q(\"INSERT INTO g5_member VALUES('v_race',3,0)\");insert_point('v_race',10000,'fixture','fixture','v_race','seed');"
subprocess.run(['php','-r',setup],check=True)
ps=[subprocess.Popen(['php','tests/vip-store/race-worker.php'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(8)]
orders=[]
for p in ps:
 out,err=p.communicate(timeout=35)
 assert p.returncode==0,err
 orders.append(json.loads(out))
assert all(o==orders[0] for o in orders)
balance=subprocess.check_output(['php','-r',"require 'tests/subscription/native_fixture.php';echo get_point_sum('v_race');"],text=True)
assert balance=='7150',balance
print('VIP_STORE_EIGHT_CONCURRENT_REQUESTS_ONE_DEBIT_OK')

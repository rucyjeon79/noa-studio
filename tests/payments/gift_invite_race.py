import os
import subprocess
assert 'dbname=noa_subscription_test;' in os.environ['NOA_MYSQL_DSN']
script = """require 'tests/subscription/native_fixture.php'; require 'bridge/special-invite.php';
try {ni_claim($argv[1],str_repeat('f',64),time());echo 'received';}
catch(DomainException $e){echo $e->getMessage();}"""
clients = [subprocess.Popen(['php','-r',script,user],stdout=subprocess.PIPE,text=True)
           for user in ('invite_a','invite_b')]
results=[client.communicate()[0] for client in clients]
assert sorted(results)==['invite_taken','received'],results
print('CONCURRENT_INVITATION_CLAIM_EXACTLY_ONE_OK')

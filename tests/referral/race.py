import subprocess
jobs=[subprocess.Popen(['php','tests/referral/race.php'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT) for _ in range(6)]
for job in jobs:
 out=job.communicate(timeout=50)[0]
 assert job.returncode==0,out.decode()
code="require 'tests/subscription/native_fixture.php'; if(get_point_sum('race_new')!==500||get_point_sum('inviter')!==1500) throw new Exception('duplicate credit'); echo 'REFERRAL_CONCURRENT_EXACTLY_ONCE_OK';"
subprocess.run(['php','-r',code],check=True)

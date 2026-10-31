"""Run the existing authenticated, expiring audit with a read-only rank inventory."""
import os
import sys
import tempfile
from pathlib import Path
import noa_membership_control as control

root=Path.cwd()
with tempfile.TemporaryDirectory() as tmp:
    scripts=Path(tmp)/'scripts'
    scripts.mkdir()
    for file in ['noa_membership_storage.php','noa_membership_verify.php']:
        (scripts/file).write_bytes((root/'scripts'/file).read_bytes())
    source=(root/'scripts/noa_membership_control.php').read_text()
    insert="""
 $report=['counts'=>[],'legacyStaffWithoutDelegation'=>0,'creatorGrants'=>0];
 $rows=ns_q('SELECT mb_level,COUNT(*) AS n FROM '.ns_table('member_table').' GROUP BY mb_level');
 while($m=sql_fetch_array($rows))$report['counts'][(int)$m['mb_level']]=(int)$m['n'];
 $rows=ns_q('SELECT mb_id FROM '.ns_table('member_table').' WHERE mb_level IN (7,8) AND mb_id<>'.ns_e($config['cf_admin']));
 while($m=sql_fetch_array($rows)){if(empty(ns_doc('ecosystem:staff:'.hash('sha256',$m['mb_id']))['data']['capabilities']))$report['legacyStaffWithoutDelegation']++;}
 $report['creatorGrants']=(int)ns_one("SELECT COUNT(*) AS n FROM noa_documents WHERE doc_key LIKE 'subscription:member:%' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.baseLevel'))='5'")['n'];
 nr_reply_control(['ok'=>true,'rankAudit'=>$report]);
"""
    (scripts/'noa_membership_control.php').write_text(source.replace(" if($mode==='verify'){",insert+" if($mode==='verify'){"))
    os.chdir(tmp)
    sys.argv=['noa_rank_audit.py','audit']
    control.main()

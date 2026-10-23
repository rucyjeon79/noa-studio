<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/guardian.php';
$p=n80_resolve_disagreement('preserve_existing_assets',false,true);
if($p['status']!=='resolved_by_user_policy'||$p['decision']!==true)exit(1);
if(n80_resolve_disagreement('unsettled_issue',false,true)['status']!=='requires_user_decision')exit(2);
$a=n80_guardian_audit(dirname(__DIR__,2).'/deploy');
if(!$a['policyCompliant']||$a['engineOperationalReady']!==false)exit(3);
echo "N80_GUARDIAN_POLICY_OK\n";

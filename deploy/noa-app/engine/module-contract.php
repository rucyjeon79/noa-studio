<?php
declare(strict_types=1);
/** Canonical owners. Legacy identifiers resolve to these owners without another executor. */
function n80_module_aliases():array {
    return ['ai_lab'=>'lab','database'=>'db','identity'=>'sign','commerce'=>'pay','app_lifecycle'=>'install'];
}
function n80_module_id(string $id):string {return n80_module_aliases()[$id]??$id;}
/** Metadata only. Do not load implementations, connect storage or run installation here. */
function n80_specialist_modules():array {
    $rows=[
        'node'=>['N80 Node','/noa-work-status.php',['install'],[],
            ['noa-app/engine/node.php'],[],
            ['engine.status','ai.muvy'],'Verified host process execution; no independent queue'],
        'setup'=>['N80 Setup','/noa-library.php',['sign'],[],
            ['noa-app/engine/setup.php','noa-app/engine/workspaces.php'],['settings'],
            ['workspace.definition','workspace.navigation'],'Site configuration navigation and access classification'],
        'install'=>['N80 Install','/noa-install.php',['sign'],[],
            ['noa-app/engine/install.php','noa-app/engine/app-lifecycle.php','noa-install.php','noa-download.php'],[],
            ['app.release_status','runtime.install','android.publish'],'Verified installation/update and existing release delivery'],
        'lab'=>['N80 Lab','/noa-ai-lab.php',['sign','db','node'],['ai.requested','ai.completed','ai.failed'],
            ['noa-app/engine/lab.php','noa-app/engine/service-runtime.php','noa-app/engine/ai-lab.php','noa-app/engine/creative.php','noa-bridge/creative.php','noa-bridge/creative-core.php','noa-bridge/creative-publication.php','noa-bridge/muvy-core.php','noa-bridge/lab-publication.php','noa-ai-lab.php','noa-app/engine/explorer.php','noa-channel-explorer.js','noa-explorer.css','noa-ai-lab.js','noa-muvy-panel.php'],['ai_lab'],
            ['signed_lab_tools'],'Production tools; N80 AI remains the planning/review role'],
        'db'=>['N80 DB','/noa-app/database/',[],[],
            ['noa-app/engine/db.php','noa-app/database/core.php','noa-bridge/storage.php'],['database'],
            ['database.connect','database.inspect'],'Existing database connections; separate read-only administration'],
        'sign'=>['N80 Sign','/noa-membership.php',[],[],
            ['noa-app/engine/sign.php','noa-bridge/member-access.php','noa-bridge/subscription-access.php','noa-app/engine/session-policy.php'],['members'],
            ['member.access','member.ownership','route.permission'],'Existing member/session/OAuth providers; unchanged permissions'],
        'pay'=>['N80 Pay','/noa-support.php',['sign','db'],[],
            ['noa-app/engine/pay.php','noa-bridge/youngcart-core.php','noa-bridge/toss-core.php','noa-bridge/support.php','noa-bridge/ainoa-points.php'],[],
            ['cart.quote','cart.benefits','payment.verify'],'Server-price and settlement validation; existing payment ledger'],
    ];
    $out=[];
    foreach($rows as $id=>[$label,$entry,$dependencies,$events,$sources,$observes,$operations,$purpose]) {
        $out[$id]=compact('label','entry','dependencies','events','sources','observes','operations','purpose')+
            ['owner'=>$id,'activation'=>'on_demand','executionProof'=>'required'];
    }
    $out['lab']['tools']=array_keys(n80_lab_tools());
    $out['lab']['sources']=array_values(array_unique(array_merge($out['lab']['sources'],array_column(n80_lab_tools(),'page'))));
    return $out;
}

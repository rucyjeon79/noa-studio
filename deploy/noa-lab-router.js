// Old saved links resolve to the same specialist without starting other modules.
(()=>{'use strict';const aliases={'#lab-text':'text','#lab-muvy':'muvy','#lab-create':'create','#lab-jobs':'jobs','#lab-growth':'growth','#settings':'settings'};const tool=aliases[location.hash];if(!tool)return;const url=new URL(location.href);url.searchParams.set('tool',tool);url.hash='';location.replace(url);})();

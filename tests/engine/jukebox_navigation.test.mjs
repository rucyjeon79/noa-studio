import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('deploy/noa-app/jukebox/navigation-policy.js','utf8');
function policy(){const context={window:{},URL,location:new URL('https://noastudio.ai.kr/noa-music.php')};vm.runInNewContext(source,context);return context.window.N80JukeBoxRoutes;}
test('all N80 workspaces use the same navigation and reload policy',()=>{const p=policy();for(const path of ['/','/noa-ai-lab.php?tool=jobs','/noa-library.php','/noa-channel-workspace.php','/noa-work-status.php','/noa-app/jukebox/','/noa-app/taxonomy/','/bbs/board.php?bo_table=music','/adm/member_list.php','/noa-music.php#my-playlists'])assert.equal(p.allows(path),true,path);});
test('authentication, transactions, downloads, handlers and external documents cannot enter the retained view',()=>{const p=policy();for(const path of ['https://example.org/noa-music.php','//example.org/noa-library.php','/noa-login.php','/noa-music-download.php?key=a','/noa-kcp-test.php','/bbs/logout.php','/shop/orderform.php','/noa-bridge/lab-api.php','/noa-ai-lab.php?action=delete','javascript:alert(1)','https://user:pass@noastudio.ai.kr/noa-music.php'])assert.equal(p.allows(path),false,path);});

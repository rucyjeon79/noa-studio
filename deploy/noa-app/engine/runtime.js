/* N80 owns page-local reads and scheduling. Importing this file performs no request. */
(()=>{'use strict';if(globalThis.N80Runtime)return;const pending=new Map(),watches=new Map();let timer=null;
function read(key,work){if(pending.has(key))return pending.get(key);const promise=Promise.resolve().then(work);pending.set(key,promise);promise.finally(()=>{if(pending.get(key)===promise)pending.delete(key);}).catch(()=>{});return promise;}
const visible=()=>!globalThis.document||document.visibilityState!=='hidden';
function schedule(){clearTimeout(timer);timer=null;if(!visible())return;const live=[...watches.values()].filter(w=>!w.running&&w.active());if(live.length)timer=setTimeout(tick,Math.max(0,Math.min(...live.map(w=>w.due))-Date.now()));}
async function tick(){timer=null;const now=Date.now();for(const w of watches.values()){if(!visible()||w.running||!w.active()||w.due>now)continue;w.running=true;read(w.key,w.work).then(value=>{w.failures=0;if(watches.get(w.key)===w)w.value(value);},error=>{w.failures=Math.min(4,w.failures+1);if(watches.get(w.key)===w)w.error(error);}).finally(()=>{w.running=false;w.due=Date.now()+w.interval*2**w.failures;schedule();});}schedule();}
function watch(key,work,value,options={}){const w={key,work,value,interval:Math.max(1000,options.interval||5000),active:options.active||(()=>true),error:options.error||(()=>{}),failures:0,running:false,due:Date.now()+(options.immediate===false?(options.interval||5000):0)};watches.set(key,w);schedule();return ()=>{if(watches.get(key)===w)watches.delete(key);schedule();};}
function wake(){for(const w of watches.values())if(w.active())w.due=Math.min(w.due,Date.now());schedule();}
globalThis.document?.addEventListener('visibilitychange',wake);globalThis.addEventListener?.('pageshow',wake);globalThis.addEventListener?.('pagehide',()=>{clearTimeout(timer);timer=null;});
globalThis.N80Runtime=Object.freeze({read,watch,wake});})();

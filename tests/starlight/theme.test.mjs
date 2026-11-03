import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const config=JSON.parse(readFileSync('deploy/noa-design.json','utf8'));
const script=readFileSync('deploy/noa-ui.js','utf8').split('/* Count-aware card layout:')[0];
async function harness({hour=12,minute=0,second=0,local=null,account=null,unavailable=false}={}){
 let now=new Date(2026,10,3,hour,minute,second).getTime(),sequence=0;
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const values=new Map(local?[['noa-ui-selection',JSON.stringify(local)]]:[]),writes=[],events={},docEvents={},timers=new Map();
 const root={dataset:{},style:{setProperty(k,v){this[k]=v}},classList:{add(){}}},meta={setAttribute(k,v){this[k]=v;}};
 const document={hidden:false,addEventListener:(name,fn)=>docEvents[name]=fn,documentElement:root,currentScript:{hasAttribute:()=>true},body:{},readyState:'complete',getElementById:()=>null,querySelector:s=>s==='meta[name="theme-color"]'?meta:null,querySelectorAll:()=>[]};
 const window={addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){}};
 const context=vm.createContext({window,document,Date:ClockDate,setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),location:{pathname:'/noa-app/database/'},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},MutationObserver:class{observe(){}},queueMicrotask,Event:class{},fetch:async(url,options)=>{
  if(options?.method==='POST')writes.push(url);
  if(url.includes('ui-preferences')&&unavailable)throw Error('offline');
  return {ok:true,json:async()=>url==='/noa-design.json'?config:url==='/noa-ui-words.json'?{}:{member:!!account,defaults:{theme:'noa-studio',enabled:['auto','noa-studio','noa-ivory']},settings:account,revision:7}};
 }});
 vm.runInContext(script,context);await new Promise(resolve=>setImmediate(resolve));
 return {window,root,values,writes,events,docEvents,timers,meta,document,setTime:(h,m=0,s=0)=>now=new Date(2026,10,3,h,m,s).getTime(),tick(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();}};
}
test('new visitors default to automatic even during a rolling server release',async()=>{
 const h=await harness();assert.equal(h.window.NoaUI.getState().theme,'auto');assert.equal(h.root.dataset.noaTheme,'noa-ivory');assert.equal(h.root.dataset.noaThemePreference,'auto');assert.equal(h.meta.content,'#FFFFFF');assert.equal(h.timers.size,1);
});
test('09:00 and 21:00 switch an open page without persisting a manual choice or writing to an account',async()=>{
 const h=await harness({hour:8,minute:59,second:59});assert.equal(h.root.dataset.noaTheme,'noa-studio');assert.equal([...h.timers.values()][0].delay,1000);
 h.setTime(9);h.tick();assert.equal(h.root.dataset.noaTheme,'noa-ivory');
 h.setTime(20,59,59);h.tick();assert.equal(h.root.dataset.noaTheme,'noa-ivory');assert.equal([...h.timers.values()][0].delay,1000);
 h.setTime(21);h.tick();assert.equal(h.root.dataset.noaTheme,'noa-studio');assert.equal(h.meta.content,config.themes[0].tokens.bg);
 assert.equal(JSON.parse(h.values.get('noa-ui-selection-v2')).theme,'auto');assert.equal(h.writes.length,0);assert.equal(h.timers.size,1);
});
test('wake, restored page and timezone/clock changes refresh automatic mode',async()=>{
 const h=await harness({hour:8});h.setTime(12);h.events.focus();assert.equal(h.root.dataset.noaTheme,'noa-ivory');
 h.setTime(23);h.docEvents.visibilitychange();assert.equal(h.root.dataset.noaTheme,'noa-studio');
 h.setTime(9);h.events.pageshow();assert.equal(h.root.dataset.noaTheme,'noa-ivory');assert.equal(h.timers.size,1);
});
test('manual choices cancel automatic switching and survive old local and account preference restoration',async()=>{
 const choice={theme:'noa-ivory',language:'ja',radius:'sharp',design:'plain'};
 const h=await harness({hour:23,local:choice,account:{...choice,language:'en'}});
 assert.equal(h.root.dataset.noaTheme,'noa-ivory');assert.equal(h.root.dataset.radius,'soft');assert.equal(h.window.NoaUI.getState().language,'en');assert.equal(h.timers.size,0);
 h.events.focus();assert.equal(h.root.dataset.noaTheme,'noa-ivory');
 h.window.NoaUI.apply({...h.window.NoaUI.getState(),theme:'auto'});assert.equal(h.root.dataset.noaTheme,'noa-studio');assert.equal(h.timers.size,1);
 h.window.NoaUI.apply({...h.window.NoaUI.getState(),theme:'noa-studio'});h.setTime(12);h.events.focus();assert.equal(h.root.dataset.noaTheme,'noa-studio');assert.equal(h.timers.size,0);assert.equal(h.writes.length,0);
});
test('stored automatic account selection and cross-tab changes retain preference semantics',async()=>{
 const h=await harness({hour:23,account:{theme:'auto',language:'ko'}});assert.equal(h.window.NoaUI.getState().theme,'auto');assert.equal(h.root.dataset.noaTheme,'noa-studio');
 h.events.storage({key:'noa-ui-selection-v2',newValue:JSON.stringify({theme:'noa-ivory',language:'ja'})});assert.equal(h.root.dataset.noaTheme,'noa-ivory');assert.equal(h.timers.size,0);
 h.events.storage({key:'noa-ui-selection-v2',newValue:JSON.stringify({theme:'auto',language:'ja'})});assert.equal(h.root.dataset.noaTheme,'noa-studio');assert.equal(h.window.NoaUI.getState().language,'ja');assert.equal(h.timers.size,1);
});
test('automatic mode still works when account preferences are unavailable or local choice is invalid',async()=>{
 const h=await harness({hour:12,local:{theme:'retired'},unavailable:true});assert.equal(h.window.NoaUI.getState().theme,'auto');assert.equal(h.root.dataset.noaTheme,'noa-ivory');
});
test('premium palettes retain neutral surfaces and accessible text and primary controls',()=>{
 assert.equal(config.defaultTheme,'auto');assert.deepEqual(config.themes.map(t=>t.id),['noa-studio','noa-ivory']);
 assert.equal(config.automaticTheme.startHour,9);assert.equal(config.automaticTheme.endHour,21);
 assert.equal(config.themes[0].tokens.darkGray,config.themes[1].tokens.darkGray);assert.equal(config.themes[1].tokens.bg,'#FFFFFF');
 const css=readFileSync('deploy/noa-starlight.css','utf8');for(const theme of config.themes)for(const key of ['bg','surface','raised','text','muted','line','accent','accentText'])assert.ok(css.includes(`--noa-${key}:${theme.tokens[key]}!important`),`${theme.id}/${key}`);
 const luminance=hex=>{const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 for(const theme of config.themes){for(const ink of ['text','muted','accent','sun','sea','forest'])for(const bg of ['bg','surface','raised'])assert.ok(contrast(theme.tokens[ink],theme.tokens[bg])>=4.5,`${theme.id}/${ink}/${bg}`);assert.ok(contrast(theme.tokens.accent,theme.tokens.accentText)>=4.5);}
});

test('an older open tab cannot normalize the new automatic preference back to dark',async()=>{
 const h=await harness({hour:12});
 assert.equal(h.values.has('noa-ui-selection'),false,'automatic choices are not written into the old-client key');
 h.events.storage({key:'noa-ui-selection',newValue:JSON.stringify({theme:'noa-studio',language:'ko'})});
 assert.equal(h.window.NoaUI.getState().theme,'auto');assert.equal(h.root.dataset.noaTheme,'noa-ivory');
 assert.equal(JSON.parse(h.values.get('noa-ui-selection-v2')).theme,'auto');
});

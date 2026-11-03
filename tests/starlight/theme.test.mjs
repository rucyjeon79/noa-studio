import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const config=JSON.parse(readFileSync('deploy/noa-design.json','utf8'));
const script=readFileSync('deploy/noa-ui.js','utf8').split('/* Count-aware card layout:')[0];
test('existing light preferences survive local, account and storage restoration without account writes',async()=>{
 const values=new Map([['noa-ui-selection',JSON.stringify({theme:'noa-ivory',radius:'sharp',design:'plain',language:'ja'})],['noa-view-lang','ja']]);
 const root={dataset:{},style:{setProperty(k,v){this[k]=v}},classList:{add(){}}};
 const writes=[];const events={};
 const document={addEventListener(){},documentElement:root,currentScript:{hasAttribute:()=>true},body:{},readyState:'complete',getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 const window={addEventListener:(name,fn)=>events[name]=fn,dispatchEvent(){}};
 const context=vm.createContext({window,document,location:{pathname:'/noa-app/database/'},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},MutationObserver:class{observe(){}},queueMicrotask,Event:class{},fetch:async(url,options)=>{if(options?.method==='POST')writes.push(url);return {ok:true,json:async()=>url==='/noa-design.json'?config:url==='/noa-ui-words.json'?{}:{member:true,defaults:{theme:'noa-ivory',enabled:['noa-ivory']},settings:{theme:'noa-ivory',language:'en',radius:'sharp',design:'plain'},revision:7}};}});
 vm.runInContext(script,context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(root.dataset.noaTheme,'noa-ivory');assert.equal(root.dataset.noaStyle,'starlight');
 assert.equal(root.dataset.radius,'soft');assert.equal(root.style['--noa-bg'],config.themes[1].tokens.bg);
 assert.equal(window.NoaUI.getState().language,'en');assert.equal(window.NoaUI.getState().theme,'noa-ivory');assert.equal(writes.length,0);
 events.storage({key:'noa-ui-selection',newValue:JSON.stringify({theme:'noa-ivory',language:'ja'})});
 assert.equal(window.NoaUI.getState().theme,'noa-ivory');assert.equal(window.NoaUI.getState().language,'ja');
 assert.equal(JSON.parse(values.get('noa-ui-selection')).theme,'noa-ivory');
});
test('dark is default and both palettes have readable text contrast',()=>{
 assert.equal(config.defaultTheme,'noa-studio');
 assert.deepEqual(config.themes.map(t=>t.id),['noa-studio','noa-ivory']);
 assert.equal(config.themes[0].tokens.darkGray,config.themes[1].tokens.darkGray);
 assert.equal(config.themes[1].name,'라이트 테마');
 assert.equal(config.themes[1].tokens.bg,'#FFFFFF');
 const css=readFileSync('deploy/noa-starlight.css','utf8');
 for(const key of ['bg','surface','raised','text','muted','line','accent','accentText'])assert.ok(css.includes(`--noa-${key}:${config.themes[0].tokens[key]}!important`),key);
 const luminance=hex=>{const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 for(const theme of config.themes)for(const ink of ['text','muted','accent'])for(const bg of ['bg','surface','raised']){const a=luminance(theme.tokens[ink]),b=luminance(theme.tokens[bg]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${ink}/${bg}`);}
});

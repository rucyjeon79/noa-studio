import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,openSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8078',out='muvy-proof';mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-muvy-fixture/html','/tmp/noa-muvy-fixture/html/router.php'],{stdio:['ignore',openSync(out+'/session-php.log','w'),openSync(out+'/session-errors.log','w')]}),browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),report=[];
try{
 for(const width of [360,768,1440])for(const theme of ['noa-studio','noa-ivory']){
  const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  const p=await c.newPage(),errors=[],writes=[],writeActions=[];let jobs=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/noa-bridge/catalog.php?*',async r=>{
   const params=new URL(r.request().url()).searchParams,view=params.get('view');
   if(view==='labMedia'&&params.get('key')==='story:test:missing'){await r.fulfill({json:{revision:4,audioUrl:'',timing:null}});return;}
   await r.fulfill({json:view==='labMedia'?{revision:9,audioUrl:'/fixture.mp3',timing:{durationSeconds:240,audioSha256:'a'.repeat(64)}}:{access:'administrator',items:[{key:'story:test:current',kind:'story',title:'현재 제목',genre:'your-story',cast:'female',ep:''},{key:'story:test:missing',kind:'story',title:'음원 연결 확인 필요',genre:'your-story',cast:'female',ep:''}]}});
  });
  await p.route('**/noa-bridge/lab-api.php?*',async r=>{
   const action=new URL(r.request().url()).searchParams.get('action'),b=r.request().postDataJSON();let body;
   if(r.request().method()==='POST')writeActions.push(action);
   if(action==='agent_start'){writes.push(b);jobs=[{id:'a'.repeat(32),title:'현재 제목',trackKey:b.trackKey,type:'agent_movie',state:'agent_planning',revision:1,outputs:[],agent:{phase:'agent_planning',sceneCount:35,planned:0,images:0,videos:0,duration:240,format:b.format,subtitles:{enabled:b.subtitles,status:'pending',count:0},connected:false}}];body={job:jobs[0]};}
   else if(action==='agent_control'){writes.push(b);jobs[0].revision++;jobs[0].state=b.action==='pause'?'agent_paused':b.action==='cancel'?'cancelled':'agent_ready';jobs[0].agent.phase=jobs[0].state;if(b.action==='resume')jobs[0].agent.subtitles={enabled:true,status:'ready',count:9};body={job:jobs[0]};}
   else if(action==='scene_plan')body={plan:{durationSeconds:240,cutCount:35,scenes:[{duration:2}]}};
   else body={jobs,config:{textEnabled:false},configured:{textAI:false,fal:false},channels:[],events:[],csrf:'fixture',generation:{ready:false,missing:['api_key']}};
   await r.fulfill({json:body});
  });
  await p.goto(base+'/noa-ai-lab.php?tool=create');await p.waitForFunction(()=>document.querySelector('#lab-health')?.textContent.includes('ChatGPT'));
  assert.equal(await p.locator('#lab-create-form input[type=file]').count(),0);
  assert.equal(await p.locator('#lab-create-form details').filter({hasText:'음원 분석·기존 제작 옵션'}).count(),0);
  assert(await p.locator('#lab-agent-start').isDisabled());
  await p.locator('#lab-audio-picker summary').click();await p.waitForFunction(()=>!document.querySelector('#lab-audio-picker-fields').disabled);
  await p.locator('#lab-track').selectOption('story:test:missing');
  await p.waitForFunction(()=>document.querySelector('#lab-source-note').textContent.includes('곡을 다시 선택'));
  assert(await p.locator('#lab-agent-start').isDisabled());assert.equal(writes.length,0);
  await p.locator('#lab-track').selectOption('story:test:current');await p.waitForFunction(()=>document.querySelector('#lab-scene-plan').textContent.includes('35컷'));
  assert(await p.locator('#lab-scene-plan').isVisible());assert(await p.locator('#lab-agent-subtitles').isChecked());assert((await p.locator('#lab-source-note').innerText()).includes('다시 업로드할 필요가 없습니다.'));
  assert(await p.locator('#lab-create-form').evaluate(form=>form.checkValidity()));
  if(width===360){await p.locator('#lab-agent-start').focus();await p.keyboard.press('Enter');}else await p.locator('#lab-agent-start').click();await p.locator('.lab-job-list progress').waitFor();
  assert.equal(writes.length,1);assert.equal(writes[0].sourceRevision,9);assert.equal(writes[0].trackKey,'story:test:current');assert(writes[0].goal.length>0);assert.equal(writes[0].format,'landscape');assert.equal(writes[0].subtitles,true);assert(await p.getByText('보컬 타이밍 분석 대기',{exact:true}).isVisible());
  const link=p.getByRole('link',{name:'ChatGPT에서 이어가기'});assert(new URL(await link.getAttribute('href')).searchParams.get('q').includes('a'.repeat(32)));
  await p.getByRole('button',{name:'잠시 멈추기',exact:true}).click();await p.getByRole('button',{name:'제작 재개',exact:true}).waitFor();await p.getByRole('button',{name:'제작 재개',exact:true}).click();await p.getByRole('button',{name:'잠시 멈추기',exact:true}).waitFor();
  for(const format of ['srt','vtt']){const download=p.getByRole('link',{name:format.toUpperCase()+' 자막 저장',exact:true});assert(await download.isVisible());const params=new URL(await download.getAttribute('href'),base).searchParams;assert.equal(params.get('action'),'agent_subtitle_download');assert.equal(params.get('format'),format);assert.equal(params.get('id'),'a'.repeat(32));}
  assert.deepEqual(writeActions.filter(a=>a!=='scene_plan'),['agent_start','agent_control','agent_control']);
  assert.equal(writes[1].expectedRevision,1);assert.equal(writes[2].expectedRevision,2);
  assert.equal(errors.length,0,errors.join('\n'));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
  assert(!await p.locator('#lab-health').innerText().then(t=>t.includes('서비스 연결 키')));
  await p.locator('#lab-create').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/agent-${theme}-${width}.png`,fullPage:true});report.push({width,theme,currentSong:true,noAudioReupload:true,missingAudioBlocked:true,optionalRequest:true,pauseResume:true,noOverflow:true});await c.close();
 }
 writeFileSync(out+'/session-agent.json',JSON.stringify({provider:'isolated responses; no paid calls',checks:report},null,2));console.log('Session agent UI: current song, optional request, durable task handoff, pause/resume and six layouts passed.');
}finally{await browser.close();server.kill('SIGTERM');}

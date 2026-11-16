// N80 source-locked synthetic viewport test; never connects to production or users.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const packagePath=process.argv[2]||'n80-ui-repair-candidate/hub-package.json';
const outputDir=process.argv[3]||'n80-ui-repair-candidate';
const pkg=JSON.parse(await fs.readFile(packagePath,'utf8'));
const files=Object.fromEntries(pkg.files.map(f=>[f.path,f]));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function getStage(name,marker){
 const file=files[name];
 if(!file)throw Error('missing '+name);
 const blob=Buffer.from(file.data,'base64');
 if(digest(blob)!==file.sha256||blob.length!==file.bytes)
  throw Error('package corruption '+name);
 const css=blob.toString('utf8');
 const pos=css.indexOf(marker);
 if(pos<0)throw Error('patch marker missing '+name);
 return {original:css.slice(0,pos),candidate:css};
}
const account=getStage('noa-account.css','/* N80 INTRINSIC ACCOUNT GRID');
const creator=getStage('noa-creator.css','/* N80 MOBILE CREATOR HIERARCHY');
const testHtml='<!doctype html><html lang="ko" class="noa-member-ui" data-noa-precision>'+
 '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body class="noa-page" style="margin:0;font:15px/1.5 system-ui">'+
 '<main id="test-main" style="padding:16px;width:100%;box-sizing:border-box">'+
 '<section id="noa-my-account" style="box-sizing:border-box;width:100%"><div class="noa-membership-card">'+
 '<dl class="noa-my-account-grid">'+
 '<div><dt>현재 구독상태</dt><dd>관리자 이용 권한 · 유료 구독 없음</dd></div>'+
 '<div><dt>잔여 포인트</dt><dd>3,930P</dd></div></dl>'+
 '<nav class="noa-my-account-actions"><a href="#">구독 관리</a><a href="#">포인트 내역</a></nav>'+
 '</div></section><section><div class="creator-tree-tools"><button>모두 펼치기</button><button>모두 접기</button></div>'+
 '<ul class="creator-tree" style="list-style:none;padding:0;margin:0">'+
 '<li><div class="creator-tree-line creator-row"><button class="creator-tree-toggle">+</button><span class="creator-tree-label">AI Artist NOA x 람준파파</span><small>5개</small></div></li>'+
 '<li><div class="creator-tree-line creator-row"><button class="creator-tree-toggle">+</button><span class="creator-tree-label">당신의 이야기, 우리의 음악</span><small>12개</small></div></li>'+
 '</ul></section></main></body></html>';
const emulateSidebar='@media(min-width:761px) and (max-width:1023px){#test-main{margin-left:190px!important;width:calc(100% - 190px)!important}}'+
 '@media(min-width:1024px){#test-main{margin-left:280px!important;width:calc(100% - 280px)!important}}';
const viewports=[
 ['phone320',320,750],['phone390',390,844],['phone412',412,915],
 ['phone540',540,910],['mid541',541,910],['phone600',600,900],
 ['phone640',640,900],['mid641',641,900],['tablet760',760,1024],
 ['tablet768',768,1024],['landscape891',891,411],['desktop1024',1024,768],
 ['desktop1280',1280,900],['desktop1920',1920,1080]
];
await fs.mkdir(outputDir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const [name,width,height] of viewports){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  for(const stage of ['original','candidate']){
   await page.setContent(testHtml,{waitUntil:'domcontentloaded'});
   await page.addStyleTag({content:account[stage]});
   await page.addStyleTag({content:creator[stage]});
   await page.addStyleTag({content:emulateSidebar});
   const measure=await page.evaluate(()=>{
    const grid=document.querySelector('.noa-my-account-grid'),children=[...grid.children];
    const columns=getComputedStyle(grid).gridTemplateColumns.split(/\s+/).map(Number.parseFloat).filter(n=>n>2);
    const first=children[0],dd=first.querySelector('dd');
    const toggle=[...document.querySelectorAll('.creator-tree-toggle')];
    const tree=document.querySelector('.creator-tree');
    return {
     columns:columns.length,containerWidth:Math.round(grid.getBoundingClientRect().width),
     cellWidth:Math.round(first.getBoundingClientRect().width),
     textHeight:Math.round(dd.getBoundingClientRect().height),
     overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
     clippedText:[...grid.querySelectorAll('dd')].some(el=>el.scrollWidth>el.clientWidth+2),
     treeOverflow:tree.scrollWidth>tree.clientWidth+2,
     toggleMinWidth:Math.min(...toggle.map(el=>el.getBoundingClientRect().width)),
     toggleMinHeight:Math.min(...toggle.map(el=>el.getBoundingClientRect().height))
    };
   });
   results.push({viewport:name,width,height,stage,...measure});
   if(stage==='candidate'){
    if(measure.overflow>2||measure.clippedText||measure.treeOverflow)
      throw Error('overlap or overflow at '+name+' '+JSON.stringify(measure));
    if(measure.toggleMinWidth<40||measure.toggleMinHeight<42)
      throw Error('toggle hit area regression at '+name);
    if(['phone320','phone390','phone412','mid541','tablet768','landscape891'].includes(name)&&measure.columns!==1)
      throw Error('fluid column collapse failed at '+name);
    if(['desktop1024','desktop1280','desktop1920'].includes(name)&&measure.columns!==2)
      throw Error('wide layout regression at '+name);
    if(name==='phone390'||name==='landscape891')
      await page.screenshot({path:path.join(outputDir,'fixture-'+name+'-candidate.png'),fullPage:true,animations:'disabled'});
   }
  }
  await context.close();
 }
}finally{await browser.close();}
const report={scope:'Synthetic CSS fixture only; NO authenticated production browser verification',
 viewports:viewports.length,cases:results.length,productionWrites:0,
 files:Object.keys(files),results};
await fs.writeFile(path.join(outputDir,'browser-fixture-report.json'),JSON.stringify(report,null,2));
const pick=(n,s)=>results.find(r=>r.viewport===n&&r.stage===s)?.cellWidth;
console.log('N80_RESPONSIVE_GRID_SMOKE',JSON.stringify({
 viewports:viewports.length,productionWrites:0,
 original390:pick('phone390','original'),adaptive390:pick('phone390','candidate'),
 original891:pick('landscape891','original'),adaptive891:pick('landscape891','candidate')
}));

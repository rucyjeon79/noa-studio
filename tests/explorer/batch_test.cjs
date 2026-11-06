const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {runInThisContext}=require('node:vm');
for(const file of ['noa-channel-explorer','noa-channel-batch'])runInThisContext(readFileSync('deploy/'+file+'.js','utf8'));
const {build,songKeys}=globalThis.NoaChannelExplorer;
const {matchFile,genres}=globalThis.NoaChannelBatch;

const songs=[
    {key:'kr',genre:'kpop-original',ep:1,title:'하루의 끝에'},
    {key:'pop',genre:'pop-original',ep:1,title:'하루의 끝에'},
    {key:'two',genre:'kpop-original',ep:2,title:'하루의 끝에'},
    {key:'kr11',genre:'kpop-original',ep:11,title:'다음'},
    {key:'story',genre:'your-story',title:'그 이름 하나'},
].map(s=>({...s,kind:'single'}));
assert.equal(matchFile('[KPOP]01_하루의 끝에.mp3',songs),'kr');
assert.equal(matchFile('[POP]EP 1 - 하루의 끝에.WAV',songs),'pop');
assert.equal(matchFile('[SM]그 이름 하나.wav',songs),'story');
assert.equal(matchFile('EP11.mp3',songs),'kr11');
assert.equal(matchFile('EP01.mp3',songs),'');
assert.equal(matchFile('하루의 끝에.mp3',songs),'');
assert.equal(matchFile('[KPOP]01_다음.mp3',songs),'');
assert.equal(matchFile('[UNKNOWN]하루의 끝에.wav',songs),'');
assert.equal(matchFile('[KPOP]01_하루의 끝에.mp3',[songs[0],{...songs[0],key:'copy'}]),'');
assert.equal(matchFile('그  이름 하나.mp3'.normalize('NFD'),songs),'story');
// Filename codes stay aligned with the download endpoint, including Thai's mixed-case spelling.
const php=readFileSync(require.resolve('../../bridge/music-download-core.php'),'utf8');
const codes=Object.fromEntries(Array.from(php.match(/\$codes=\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'=>'([^']+)'/g),m=>[m[2].toUpperCase(),m[1]]));
assert.deepEqual(genres,codes);
const lists=['a','b'].map(key=>({key,kind:'playlist',title:key,genre:'kpop-original',members:[{key:'kr'}]}));
const tree=build([...lists,...songs],'test',{groupActs:true});
const genre=tree.children[0].children.find(n=>n.genre==='kpop-original');
assert.deepEqual(new Set(songKeys(genre)),new Set(['kr','two','kr11']));
assert.equal(songKeys(genre).length,3);
assert.deepEqual(songKeys(genre.children.find(n=>n.type==='act'&&n.act===2)),['kr11']);
assert.equal(genre.children.filter(n=>n.type==='collection'&&songKeys(n).includes('kr')).length,2);
assert.equal(songKeys(tree).length,5);
console.log('CHANNEL_BATCH_SELECTION_AND_FILE_MATCH_OK');

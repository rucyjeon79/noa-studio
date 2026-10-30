import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('deploy/noa-ui.js','utf8');
const section=vm.runInNewContext(source.slice(source.indexOf('function sectionFor('),source.indexOf('function sectionNavigation('))+';sectionFor');
test('related routes retain the correct destination highlight',()=>{
 for(const [key,paths] of Object.entries({youtube:['/noa-youtube.php','/noa-world.php'],music:['/noa-music.php','/noa-my.php','/noa-catalog.php'],community:['/noa-lounge.php','/noa-creator-lab.php','/bbs/board.php','/bbs/write.php'],shop:['/noa-shop.php','/noa-vip.php','/noa-points.php'],home:['/','/index.php']}))for(const path of paths)assert.equal(section(path),key,path);
 assert.equal(section('/bbs/login.php'),'');
});
test('five primary destinations place home in the center',()=>{
 const menu=vm.runInNewContext(source.slice(source.indexOf('function menu('),source.indexOf('function sectionFor('))+';menu');
 assert.equal(menu().map(x=>x[0]).join(','),'youtube,music,home,community,shop');
 assert.equal(new Set(menu().map(x=>x[2])).size,5);
});

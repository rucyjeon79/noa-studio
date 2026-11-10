import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {restoreRepository} from '../../runtime/hub/repository.mjs';
test('offline source restoration keeps history, rejects tampering and preserves a later owner commit',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-repository-'));fs.chmodSync(root,0o700);
 const source=path.join(root,'original');fs.mkdirSync(source);
 const git=(...args)=>execFileSync('/usr/bin/git',args,{cwd:source,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 try{
  git('init','-b','main');git('config','user.name','Isolated test');git('config','user.email','test@example.invalid');
  fs.writeFileSync(path.join(source,'app.txt'),'one');git('add','app.txt');git('commit','-m','one');const first=git('rev-parse','HEAD');
  git('bundle','create',path.join(root,'source.bundle'),'HEAD');
  fs.writeFileSync(path.join(source,'app.txt'),'two');git('commit','-am','two');const second=git('rev-parse','HEAD'),file=`history-${second}.bundle`;
  git('bundle','create',path.join(root,file),first+'..HEAD');
  const manifest={bundleCommit:first,bundleSha256:digest('source.bundle'),historyHead:second,history:[{base:first,commit:second,file,sha256:digest(file)}]};
  fs.writeFileSync(path.join(root,'source.json'),JSON.stringify(manifest));
  assert.equal(restoreRepository(root).commit,second);assert.equal(restoreRepository(root).commit,second);
  const clone=path.join(root,'restored');git('clone',path.join(root,'repository.git'),clone);assert.equal(fs.readFileSync(path.join(clone,'app.txt'),'utf8'),'two');
  assert.equal(execFileSync('/usr/bin/git',['log','--format=%s'],{cwd:clone,encoding:'utf8'}).trim(),'two\none');
  const saved=fs.readFileSync(path.join(root,file));fs.appendFileSync(path.join(root,file),'tamper');assert.throws(()=>restoreRepository(root),/bundle_checksum/);fs.writeFileSync(path.join(root,file),saved);
  fs.writeFileSync(path.join(source,'app.txt'),'three');git('commit','-am','three');const third=git('rev-parse','HEAD');git('push',path.join(root,'repository.git'),'HEAD:refs/heads/main');
  assert.throws(()=>restoreRepository(root),/concurrent_head/);assert.equal(git('--git-dir='+path.join(root,'repository.git'),'rev-parse','HEAD'),third);
 }catch(error){console.error('ISOLATED_GIT_DIAGNOSTIC',error.cause||error.message);throw error;}finally{fs.rmSync(root,{recursive:true,force:true});}
});

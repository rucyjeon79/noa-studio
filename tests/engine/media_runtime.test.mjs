import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPackage,reusePackage} from '../../runtime/media/host-runner.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
test('host activation rejects corrupt files, symlinks and escaped manifests',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'n80-media-verify-'));
 try{
  const bytes=Buffer.from('verified system package');
  await fs.writeFile(folder+'/tool',bytes);
  async function manifest(entries){const data=JSON.stringify(entries);await fs.writeFile(folder+'/package.json',data);return sha(data);}
  const entries={tool:{sha256:sha(bytes),bytes:bytes.length}};
  const digest=await manifest(entries);
  assert.deepEqual(await verifyPackage(folder,folder+'/package.json',digest),{verified:true,files:1,bytes:bytes.length});
  await fs.writeFile(folder+'/tool',Buffer.alloc(bytes.length));
  await assert.rejects(verifyPackage(folder,folder+'/package.json',digest),/checksum/);
  await fs.rm(folder+'/tool');await fs.symlink(folder+'/package.json',folder+'/tool');
  await assert.rejects(verifyPackage(folder,folder+'/package.json',digest),/checksum/);
  await assert.rejects(verifyPackage(folder,folder+'/package.json',await manifest({'../escape':entries.tool})),/manifest_path/);
  await assert.rejects(verifyPackage(folder,folder+'/package.json',await manifest({})),/manifest_invalid/);
  await assert.rejects(verifyPackage(folder,folder+'/package.json','0'.repeat(64)),/manifest_checksum/);
 }finally{await fs.rm(folder,{recursive:true,force:true});}
});

test('reuse links only matching libraries, never corrupt bytes or old executables',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'n80-reuse-'));
 try{
  const previous=root+'/ffmpeg-'+'a'.repeat(64),folder=root+'/ffmpeg-'+'b'.repeat(64);
  await fs.mkdir(previous+'/lib',{recursive:true});await fs.mkdir(previous+'/bin');await fs.mkdir(folder);
  const bytes=Buffer.from('verified library'),entry={sha256:sha(bytes),bytes:bytes.length};
  await fs.writeFile(previous+'/lib/good.so',bytes);await fs.writeFile(previous+'/lib/bad.so',Buffer.alloc(bytes.length));
  await fs.writeFile(previous+'/bin/ffmpeg',bytes);await fs.symlink(previous+'/lib/good.so',previous+'/lib/link.so');
  const data=JSON.stringify({'lib/good.so':entry,'lib/bad.so':entry,'lib/link.so':entry,'bin/ffmpeg':entry});
  await fs.writeFile(folder+'/package.json',data);
  assert.deepEqual(await reusePackage(root,folder,folder+'/package.json',sha(data)),{ok:true,reused:1});
  assert.equal((await fs.stat(previous+'/lib/good.so')).ino,(await fs.stat(folder+'/lib/good.so')).ino);
  assert.deepEqual(await fs.readdir(folder+'/lib'),['good.so']);
  await assert.rejects(fs.stat(folder+'/bin/ffmpeg'),{code:'ENOENT'});
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

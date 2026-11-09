import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPackage} from '../../runtime/media/host-runner.mjs';

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

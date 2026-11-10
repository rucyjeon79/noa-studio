/** Restore N80's private Git repository only from its verified, local source bundles. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const fixedRoot='/hosting/noastudio/noa-hub';
const sha40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const sha256=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function fail(code){throw new Error('hub_repository_'+code);}
function git(root,args,allowFailure=false){
 const r=spawnSync('/usr/bin/git',['-c','core.hooksPath=/dev/null','-c','fetch.unpackLimit=0','-c','transfer.unpackLimit=0',...args],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:1048576,env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}});
 if(r.status!==0&&!allowFailure)throw new Error('hub_repository_git_command_failed',{cause:{status:r.status,operation:args.filter(a=>!a.startsWith('--git-dir='))[0],diagnostic:(r.stderr||r.error?.code||'').slice(0,1200)}});return {status:r.status,text:(r.stdout||'').trim()};
}
function regular(root,name,digest){
 const file=path.join(root,name);if(!sha256(digest)||!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.realpathSync(file)!==file)fail('unsafe_bundle');
 if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==digest)fail('bundle_checksum');return file;
}
export function restoreRepository(root){
 process.umask(0o077);
 if(!fs.lstatSync(root).isDirectory()||fs.realpathSync(root)!==root||(fs.statSync(root).mode&0o077))fail('unsafe_root');
 const manifest=path.join(root,'source.json');if(!fs.lstatSync(manifest).isFile()||fs.realpathSync(manifest)!==manifest)fail('unsafe_manifest');
 const source=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(!sha40(source.bundleCommit)||!Array.isArray(source.history||[]))fail('manifest_invalid');
 const chain=[{file:'source.bundle',commit:source.bundleCommit,sha256:source.bundleSha256}];let head=source.bundleCommit;
 for(const row of source.history||[]){
  if(!sha40(row.commit)||row.base!==head||row.file!==`history-${row.commit}.bundle`)fail('history_gap');chain.push(row);head=row.commit;
 }
 if(source.historyHead&&source.historyHead!==head)fail('history_head');
 for(const row of chain)regular(root,row.file,row.sha256);
 const target=path.join(root,'repository.git'),lock=path.join(root,'repository.lock');
 try{fs.mkdirSync(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')fail('busy');throw e;}
 let staging;
 try{
  const version=git(root,['--version']).text;if(!/^git version [0-9.]+/.test(version))fail('git_unavailable');
  const exists=fs.existsSync(target);
  if(exists&&(!fs.lstatSync(target).isDirectory()||fs.realpathSync(target)!==target))fail('unsafe_repository');
  if(!exists){
   const space=fs.statfsSync(root),required=chain.reduce((n,r)=>n+fs.statSync(path.join(root,r.file)).size,0)*3+20971520;
   if(space.bavail*space.bsize<required)fail('storage_insufficient');
   staging=path.join(root,'repository.stage-'+crypto.randomBytes(8).toString('hex'));fs.mkdirSync(staging,{mode:0o700});git(root,['init','--bare',staging]);
  }
  const repo=exists?target:staging,at=(...args)=>git(root,['--git-dir='+repo,...args]);
  if(at('rev-parse','--is-bare-repository').text!=='true')fail('not_bare');
  let previous=exists?at('rev-parse','refs/heads/main').text:null;
  const allowed=new Set(chain.map(r=>r.commit));if(previous&&!allowed.has(previous))fail('concurrent_head');
  for(const row of chain){
   const file=path.join(root,row.file),heads=at('bundle','list-heads',file).text.split('\n');
   if(!heads.includes(row.commit+' HEAD'))fail('bundle_head');
   at('bundle','verify',file);
   // Existing verified history is local; import only missing commits instead of
   // repeatedly unpacking the initial full archive for every small Hub update.
   if(git(root,['--git-dir='+repo,'cat-file','-e',row.commit+'^{commit}'],true).status!==0)at('fetch','--no-tags',file,'HEAD');
   if(at('cat-file','-t',row.commit).text!=='commit')fail('commit_missing');
  }
  if(previous&&git(root,['--git-dir='+repo,'merge-base','--is-ancestor',previous,head],true).status!==0)fail('not_fast_forward');
  at('update-ref','refs/heads/main',head,previous||'0'.repeat(40));at('symbolic-ref','HEAD','refs/heads/main');
  // Materialize complete pack indexes before the full connectivity/integrity check.
  at('repack','-a','-d');at('fsck','--full','--no-dangling');
  if(!exists){fs.renameSync(staging,target);staging=null;}
  const actual=git(root,['--git-dir='+target,'rev-parse','refs/heads/main']).text;if(actual!==head)fail('readback');
  return {commit:head,bare:true,bundles:chain.length,gitVersion:version,githubRequired:false};
 }finally{if(staging)fs.rmSync(staging,{recursive:true,force:true});fs.rmdirSync(lock);}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');if(root!==fixedRoot)fail('host_required');
 try{console.log('N80_HUB_REPOSITORY '+JSON.stringify(restoreRepository(root)));}catch(e){console.error(/^hub_repository_[a-z_]+$/.test(e.message)?e.message:'hub_repository_failed');process.exitCode=1;}
}

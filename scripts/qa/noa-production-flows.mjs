/* The former one-off flow snapshot required looping and removed category controls.
   Delegate to the current shared live acceptance gate so requirements cannot diverge. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=process.env.NOA_SOURCE_ROOT||process.env.GITHUB_WORKSPACE||process.cwd(),entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'noa-current-live-gates.mjs');
fs.copyFileSync(path.join(root,'scripts/qa/noa-uiux-release.mjs'),entry);
const run=spawnSync(process.execPath,[entry],{env:{...process.env,NOA_SOURCE_ROOT:root,NOA_UIUX_PHASE:'live'},stdio:'inherit'});if(run.error)throw run.error;if(run.status!==0)process.exit(run.status||1);

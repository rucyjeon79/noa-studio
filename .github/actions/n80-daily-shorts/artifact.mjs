import {DefaultArtifactClient} from '@actions/artifact';
import fs from 'node:fs';
import path from 'node:path';

// Only encrypted bytes enter the SDK. No source text or credentials in receipts.
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const client = new DefaultArtifactClient();
const repository = 'rucyjeon79/noa-studio';
function options(run) {
  if (run.repository !== repository || !Number.isSafeInteger(run.runId) || run.runId < 1 ||
      !/^n80-media-[a-f0-9]{64}$/.test(run.name)) throw new Error('invalid_identity');
  return {findBy: {token: process.env.GH_TOKEN, workflowRunId: run.runId,
    repositoryOwner: 'rucyjeon79', repositoryName: 'noa-studio'}};
}
try {
  if (process.env.GITHUB_REPOSITORY !== repository) throw new Error('wrong_repository');
  const opts = options(request.run);
  let result;
  if (request.op === 'find') {
    // Listing (rather than catching get errors) distinguishes absent from denied.
    const list = await client.listArtifacts(opts);
    const matches = list.artifacts.filter(a => a.name === request.run.name);
    if (matches.length > 1) throw new Error('ambiguous_artifact');
    result = {id: matches[0]?.id ?? null};
  } else if (request.op === 'upload') {
    if (String(request.run.runId) !== process.env.GITHUB_RUN_ID ||
        String(request.run.attempt) !== process.env.GITHUB_RUN_ATTEMPT) throw new Error('wrong_run');
    result = await client.uploadArtifact(request.run.name, [request.path], path.dirname(request.path),
      {retentionDays: 90, compressionLevel: 0});
    if (!result.id) throw new Error('upload_unconfirmed');
    result = {id: result.id};
  } else if (request.op === 'download') {
    if (!Number.isSafeInteger(request.id) || request.id < 1) throw new Error('invalid_artifact_id');
    result = await client.downloadArtifact(request.id, {...opts, path: request.path});
    if (result.digestMismatch) throw new Error('artifact_digest_mismatch');
    result = {downloaded: true};
  } else throw new Error('unsupported_operation');
  fs.writeFileSync(request.result, JSON.stringify(result), {mode: 0o600});
} catch {
  // SDK errors may contain signed URLs. The parent logs only this category.
  process.exitCode = 1;
}

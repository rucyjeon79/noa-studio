/** Retired after Dothome shared-host resource suspension.
 * Legacy pure contract helpers remain for historical tests and parsing only.
 * This file never polls, starts network requests, changes state, or spawns.
 */
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function signature(body, key, timestamp, nonce) {
  return crypto.createHmac('sha256', key).update(
    `N80-HUB-1\n${crypto.createHash('sha256').update(body).digest('hex')}\n${timestamp}\n${nonce}`
  ).digest('hex');
}
export function due(operation, row, state, requested, now) {
  if (state.pending) return now >= (state.nextAt || 0);
  return !state.unconfirmed && (now >= (state.nextAt || 0) || (requested || 0) > (state.requestedAt || 0));
}
export async function run() {
  throw new Error('hub_resident_runner_retired');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.error('hub_resident_runner_retired');
  process.exitCode = 78;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../../deploy/noa-playlists.js', import.meta.url), 'utf8');

test('refresh restores persisted playlist revision, tracks, and title', () => {
  assert.match(source, /const current=items\.find\(p=>p\.playlist_id===id\)/);
  assert.match(source, /if\(current\)\{revision=current\.revision;working=\[\.\.\.current\.tracks\];title\.value=current\.title;\}/);
});

test('saved playlist refresh does not discard unsaved draft', () => {
  assert.ok(source.includes("else if(picker.value===''){revision=0;}"));
});

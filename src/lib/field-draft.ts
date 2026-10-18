type DraftRow = { text: string; base: string };

const drafts = new Map<string, DraftRow>();
const watchers = new Set<() => void>();
let rev = 0;

function bump() {
  rev += 1;
  watchers.forEach((notify) => notify());
}

function keyOf(scope: string, id: string) {
  return `${scope}\n${id}`;
}

export function watchFieldDrafts(onChange: () => void) {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}

export function fieldDraftRev() {
  return rev;
}

export function noteFieldDraft(scope: string, id: string, text: string, base: string) {
  if (!scope || !id) return;
  const key = keyOf(scope, id);
  const prev = drafts.get(key);
  if (text === base) {
    if (!prev) return;
    drafts.delete(key);
    bump();
    return;
  }
  if (prev && prev.text === text && prev.base === base) return;
  drafts.set(key, { text, base });
  bump();
}

export function forgetFieldDraft(scope: string, id: string) {
  if (!scope || !id) return;
  if (!drafts.delete(keyOf(scope, id))) return;
  bump();
}

export function fieldDrafts(scope: string) {
  if (!scope) return [] as { id: string; text: string }[];
  const prefix = `${scope}\n`;
  const out: { id: string; text: string }[] = [];
  for (const [key, row] of drafts) {
    if (!key.startsWith(prefix) || row.text === row.base) continue;
    out.push({ id: key.slice(prefix.length), text: row.text });
  }
  return out;
}

export function fieldDraftOn(scope: string) {
  return fieldDrafts(scope).length > 0;
}

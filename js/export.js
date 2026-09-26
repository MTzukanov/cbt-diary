import { t, getLang } from './i18n.js';
import { migrate, sortedEntries } from './store.js';
import { emotionId, emotionLabel } from './emotions.js';
import { fieldLabel } from './fields.js';

export const EXPORT_APP = 'cbt-diary';

export function toJSON(data, now = new Date()) {
  return JSON.stringify({ app: EXPORT_APP, exportedAt: now.toISOString(), ...data }, null, 2);
}

export function formatDateTime(datetime) {
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return datetime;
  return new Intl.DateTimeFormat(getLang(), { dateStyle: 'full', timeStyle: 'short' }).format(d);
}

// Human-readable export in the current language, oldest entry first.
// Hidden fields are included when they hold text, so nothing is lost.
export function toPlainText(data, now = new Date()) {
  const lines = [t('app.title'), t('export.exported', { date: formatDateTime(now) }), ''];
  for (const e of sortedEntries(data.entries).reverse()) {
    lines.push(`=== ${formatDateTime(e.datetime)} ===`, '');
    for (const f of data.settings.fields) {
      if (f.type === 'emotions') {
        if (!e.emotions.length) continue;
        const list = e.emotions.map((em) => `${emotionLabel(em)} ${em.intensity}/10`).join(', ');
        lines.push(`${fieldLabel(f)}: ${list}`, '');
      } else if (e.values[f.id]) {
        lines.push(`${fieldLabel(f)}:`, e.values[f.id], '');
      }
    }
  }
  return lines.join('\n');
}

// Accepts parsed JSON from an export. Returns null when it does not look like one.
export function parseImport(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.entries)) return null;
  return migrate(json);
}

// Merges an import into the current data: entries by id, newer updatedAt wins.
// Current settings stay; custom fields and emotions from the import are added.
export function mergeData(current, incoming) {
  const result = structuredClone(current);
  let added = 0;
  let updated = 0;

  const byId = new Map(result.entries.map((e, i) => [e.id, i]));
  for (const e of incoming.entries) {
    if (!byId.has(e.id)) {
      result.entries.push(e);
      added++;
    } else if (e.updatedAt > result.entries[byId.get(e.id)].updatedAt) {
      result.entries[byId.get(e.id)] = e;
      updated++;
    }
  }

  for (const f of incoming.settings.fields) {
    if (!result.settings.fields.some((x) => x.id === f.id)) result.settings.fields.push(f);
  }
  const own = result.settings.customEmotions;
  for (const name of incoming.settings.customEmotions) {
    if (!own.some((x) => emotionId({ name: x }) === emotionId({ name }))) own.push(name);
  }

  return { data: result, added, updated };
}

export function exportFileName(ext, now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `cbt-diary-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${ext}`;
}

// On phones the share sheet lets you save to Files or send the file on;
// elsewhere a plain download is less surprising.
export async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  const touch = globalThis.matchMedia?.('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

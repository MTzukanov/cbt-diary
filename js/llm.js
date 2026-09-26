// Entries written with an outside AI chat: the app builds a prompt from the
// user's settings, the chat interviews the user and replies with a JSON block,
// and the user pastes that block back. Nothing here talks to the network.
import en from './locales/en.js';
import { DICTS } from './i18n.js';
import { PRESET_EMOTIONS, emotionLabel } from './emotions.js';
import { fieldLabel } from './fields.js';
import { localDateTime, clampIntensity, normalizeEntry, newId } from './store.js';

export const FORMAT = 'cbt-diary/v1';

// Names for the chat, which reads English instructions best.
const LANGUAGE_NAMES = { en: 'English', uk: 'Ukrainian', ru: 'Russian', fi: 'Finnish' };

export function buildPrompt(settings, lang, now = new Date()) {
  const language = LANGUAGE_NAMES[lang] || 'English';
  const fields = settings.fields.filter((f) => !f.hidden);
  const textFields = fields.filter((f) => f.type === 'text');
  const hasEmotions = fields.some((f) => f.type === 'emotions');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);

  const fieldLines = fields.map((f) => {
    const hint = f.type === 'emotions'
      ? 'emotions with how strong each was, 0-10.'
      : (f.builtin && !f.label && en[`field.${f.id}.hint`]) || '';
    return `- ${f.id}: "${fieldLabel(f)}"${hint ? ` - ${hint}` : ''}`;
  });

  const example = { datetime: 'YYYY-MM-DDTHH:MM' };
  for (const f of fields) {
    example[f.id] = f.type === 'emotions' ? [{ emotion: 'anxiety', intensity: 7 }] : '...';
  }

  const lines = [
    'You are helping me fill in my CBT diary. It uses the SMER method: Situation, thoughts, Emotions, Reactions, plus conclusions.',
    'Your job is to help me put my own experience into the diary\'s structure. Do not write it for me and do not act as my therapist.',
    '',
    'How to talk with me:',
    `- Speak ${language}, and write every diary text in ${language}.`,
    '- Start by asking what happened. Then go through the fields below one short question at a time.',
    '- Keep my thoughts in my own words, in the first person, as they went through my mind. Do not soften, correct or reframe them.',
    '- Never invent details' + (hasEmotions ? ', emotions or ratings. Ask me to rate each emotion from 0 (none) to 10 (strongest).' : '.'),
    '- Keep the texts short and in my words. At most, tidy the grammar.',
    '- If I describe more than one situation, make a separate entry for each.',
    '- If I mention wanting to hurt myself or someone else, stop the diary, respond with care and point me to local emergency or crisis help.',
    '- When every field is covered, show me the entries in plain words and ask if anything should change. Once I confirm, give me the result as described at the end.',
    '',
    `It is now ${weekday}, ${localDateTime(now)} my local time. Use this to turn things like "yesterday evening" into a date and time. If I do not say when it happened, ask.`,
    '',
    'Diary fields (key: name - what goes there):',
    ...fieldLines,
  ];

  if (hasEmotions) {
    const presets = PRESET_EMOTIONS.map((key) => (lang === 'en' ? key : `${key} (${emotionLabel({ key })})`));
    lines.push('', `Emotions: when one of these fits, use its key: ${presets.join(', ')}.`);
    if (settings.customEmotions.length) {
      lines.push(`My own emotions, use them as written: ${settings.customEmotions.join(', ')}.`);
    }
    lines.push(`Otherwise write the emotion's name in ${language}.`);
  }

  lines.push(
    '',
    'Result: one code block marked json, with this shape and nothing else in it:',
    '```json',
    JSON.stringify({ format: FORMAT, entries: [example] }, null, 2),
    '```',
    `datetime is my local time, without a time zone. Leave out a field I had nothing for${textFields.length ? '. Use \\n for line breaks inside texts' : ''}. I will copy the block into the diary app.`,
  );

  return lines.join('\n');
}

// Finds the entries in a pasted chat reply. Returns { entries } where each item is
// { entry, warnings, duplicate }, or { error: 'noData' }.
export function parseLlmResponse(text, data, now = new Date()) {
  const raw = findEntries(String(text || ''));
  if (!raw) return { error: 'noData' };

  const match = fieldMatcher(data.settings);
  const custom = data.settings.customEmotions;
  const entries = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const parsed = toEntry(item, match, custom, now);
    if (!Object.keys(parsed.entry.values).length && !parsed.entry.emotions.length) continue;
    parsed.duplicate = isDuplicate(parsed.entry, data.entries);
    entries.push(parsed);
  }
  return entries.length ? { entries } : { error: 'noData' };
}

// Adds parsed entries to a copy of the data, plus any new emotion names to the user's list.
export function addEntries(data, entries, now = new Date()) {
  const result = structuredClone(data);
  const stamp = now.toISOString();
  const own = result.settings.customEmotions;
  for (const e of entries) {
    for (const em of e.emotions) {
      if (em.name && !own.some((x) => x.toLowerCase() === em.name.toLowerCase())) own.push(em.name);
    }
    result.entries.push(normalizeEntry({ ...e, id: newId(), createdAt: stamp, updatedAt: stamp }));
  }
  return result;
}

// Emotion names in entries that the user's list does not have yet.
export function newEmotionNames(entries, customEmotions) {
  const names = [];
  for (const e of entries) {
    for (const em of e.emotions) {
      const known = [...customEmotions, ...names].some((x) => x.toLowerCase() === em.name?.toLowerCase());
      if (em.name && !known) names.push(em.name);
    }
  }
  return names;
}

function findEntries(text) {
  const candidates = [...text.matchAll(/```[\w-]*[^\S\n]*\n?([\s\S]*?)```/g)].map((m) => m[1]);
  const i = text.indexOf('{');
  const j = text.lastIndexOf('}');
  if (i >= 0 && j > i) candidates.push(text.slice(i, j + 1));
  const a = text.indexOf('[');
  const b = text.lastIndexOf(']');
  if (a >= 0 && b > a) candidates.push(text.slice(a, b + 1));

  for (const c of candidates) {
    const json = tryParse(c.trim());
    const list = Array.isArray(json) ? json : Array.isArray(json?.entries) ? json.entries : null;
    if (list?.length) return list;
    if (json && typeof json === 'object' && ('situation' in json || 'datetime' in json)) return [json];
  }
  return null;
}

// Tolerates the usual chat slips: trailing commas, and typographic quotes when
// the whole block lost its straight ones.
function tryParse(s) {
  const attempts = [s, s.replace(/,(\s*[}\]])/g, '$1')];
  if (!s.includes('"')) attempts.push(attempts[1].replace(/[“”„‟″]/g, '"'));
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try the next repair
    }
  }
  return undefined;
}

// Chat keys map to fields by id, or by the field's name as a fallback.
function fieldMatcher(settings) {
  const byKey = new Map();
  for (const f of settings.fields) {
    byKey.set(f.id.toLowerCase(), f);
    byKey.set(fieldLabel(f).toLowerCase(), f);
    if (f.builtin) byKey.set(en[`field.${f.id}`].toLowerCase(), f);
  }
  return (key) => byKey.get(key.trim().toLowerCase());
}

const IGNORED_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'values', 'format']);

function toEntry(item, match, custom, now) {
  const src = { ...item, ...(item.values && typeof item.values === 'object' ? item.values : {}) };
  const warnings = [];
  const entry = { datetime: '', values: {}, emotions: [] };
  const unknown = [];

  for (const [key, value] of Object.entries(src)) {
    if (IGNORED_KEYS.has(key) || key === 'datetime' || key === 'date') continue;
    const field = match(key);
    if (field?.type === 'emotions') {
      entry.emotions = toEmotions(value, custom);
    } else if (field) {
      const v = toText(value);
      if (v) entry.values[field.id] = v;
    } else if (toText(value)) {
      unknown.push(key);
    }
  }

  const when = toDateTime(src.datetime ?? src.date);
  if (!when.value) warnings.push({ key: 'ai.warn.noDate' });
  else if (when.noTime) warnings.push({ key: 'ai.warn.noTime' });
  entry.datetime = when.value || localDateTime(now);
  if (unknown.length) warnings.push({ key: 'ai.warn.unknown', vars: { names: unknown.join(', ') } });

  return { entry, warnings, duplicate: false };
}

function toText(v) {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join('\n');
  return '';
}

// "YYYY-MM-DDTHH:MM" is kept as written (local time). With a time zone it is
// converted to local time. A bare date gets noon.
function toDateTime(v) {
  if (typeof v !== 'string') return {};
  const s = v.trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!m) return {};
  if (!m[2]) return { value: `${m[1]}T12:00`, noTime: true };
  if (m[3]) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? {} : { value: localDateTime(d) };
  }
  const d = new Date(`${m[1]}T${m[2]}`);
  return Number.isNaN(d.getTime()) ? {} : { value: `${m[1]}T${m[2]}` };
}

// Preset emotions are recognised by key or by their name in any app language,
// so "тревога" and "anxiety" both become the anxiety preset.
function presetByName() {
  const map = new Map();
  for (const key of PRESET_EMOTIONS) {
    map.set(key, key);
    for (const dict of Object.values(DICTS)) map.set(dict[`emotion.${key}`].toLowerCase(), key);
  }
  return map;
}

function toEmotions(value, custom) {
  if (!Array.isArray(value)) return [];
  const presets = presetByName();
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const name = String((typeof item === 'string' ? item : item?.emotion ?? item?.key ?? item?.name) ?? '').trim();
    if (!name) continue;
    const key = presets.get(name.toLowerCase());
    const own = custom.find((c) => c.toLowerCase() === name.toLowerCase());
    const emotion = key ? { key } : { name: own || name };
    const id = key ? `k:${key}` : `n:${emotion.name.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...emotion, intensity: clampIntensity(item?.intensity) });
  }
  return out;
}

function isDuplicate(entry, existing) {
  return existing.some(
    (e) =>
      e.datetime === entry.datetime &&
      Object.entries(entry.values).every(([k, v]) => (e.values[k] || '') === v),
  );
}

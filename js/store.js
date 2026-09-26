// All diary data lives in one localStorage key as JSON.
// Pure helpers are exported separately so they can be tested under node.

export const STORAGE_KEY = 'cbt-diary:v1';
export const VERSION = 1;

export const BUILTIN_FIELDS = [
  { id: 'situation', type: 'text' },
  { id: 'thoughts', type: 'text' },
  { id: 'emotions', type: 'emotions' },
  { id: 'reactions', type: 'text' },
  { id: 'conclusions', type: 'text' },
];

export function newId(prefix = '') {
  // crypto.randomUUID needs a secure context, which a phone on a LAN address is not.
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function defaultData() {
  return {
    version: VERSION,
    settings: {
      lang: null,
      fields: BUILTIN_FIELDS.map((f) => ({ ...f, builtin: true, hidden: false, label: null })),
      customEmotions: [],
    },
    entries: [],
  };
}

// Brings any stored or imported object up to the current shape without dropping data.
export function migrate(raw) {
  const data = defaultData();
  if (!raw || typeof raw !== 'object') return data;

  const s = raw.settings || {};
  if (typeof s.lang === 'string') data.settings.lang = s.lang;
  if (Array.isArray(s.customEmotions)) {
    data.settings.customEmotions = s.customEmotions.filter((e) => typeof e === 'string' && e.trim());
  }
  if (Array.isArray(s.fields)) {
    const seen = new Set();
    const fields = s.fields
      .filter((f) => f && typeof f.id === 'string' && !seen.has(f.id) && seen.add(f.id))
      .map((f) => ({
        id: f.id,
        type: f.type === 'emotions' ? 'emotions' : 'text',
        builtin: BUILTIN_FIELDS.some((b) => b.id === f.id),
        hidden: !!f.hidden,
        label: typeof f.label === 'string' && f.label.trim() ? f.label : null,
      }));
    // A built-in field can be hidden but never lost.
    for (const b of data.settings.fields) {
      if (!fields.some((f) => f.id === b.id)) fields.push(b);
    }
    data.settings.fields = fields;
  }

  if (Array.isArray(raw.entries)) {
    data.entries = raw.entries.filter((e) => e && typeof e.id === 'string').map(normalizeEntry);
  }
  return data;
}

export function normalizeEntry(e) {
  const now = new Date().toISOString();
  return {
    id: e.id || newId(),
    datetime: typeof e.datetime === 'string' ? e.datetime : localDateTime(new Date()),
    values: e.values && typeof e.values === 'object' ? { ...e.values } : {},
    emotions: Array.isArray(e.emotions)
      ? e.emotions
          .filter((x) => x && (x.key || x.name))
          .map((x) => ({
            ...(x.key ? { key: String(x.key) } : { name: String(x.name) }),
            intensity: clampIntensity(x.intensity),
          }))
      : [],
    createdAt: e.createdAt || now,
    updatedAt: e.updatedAt || e.createdAt || now,
  };
}

export function clampIntensity(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(10, Math.max(0, v)) : 5;
}

// "YYYY-MM-DDTHH:MM" in local time, the format <input type="datetime-local"> uses.
export function localDateTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function sortedEntries(entries) {
  return [...entries].sort((a, b) => b.datetime.localeCompare(a.datetime) || b.createdAt.localeCompare(a.createdAt));
}

export function createStore(storage = globalThis.localStorage) {
  let data = load(storage);

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  return {
    get data() {
      return data;
    },
    persist,
    getEntry(id) {
      return data.entries.find((e) => e.id === id) || null;
    },
    saveEntry(entry) {
      const now = new Date().toISOString();
      const existing = data.entries.findIndex((e) => e.id === entry.id);
      if (existing >= 0) {
        data.entries[existing] = normalizeEntry({ ...entry, createdAt: data.entries[existing].createdAt, updatedAt: now });
      } else {
        data.entries.push(normalizeEntry({ ...entry, id: entry.id || newId(), createdAt: now, updatedAt: now }));
      }
      persist();
    },
    deleteEntry(id) {
      data.entries = data.entries.filter((e) => e.id !== id);
      persist();
    },
    updateSettings(fn) {
      fn(data.settings);
      persist();
    },
    replace(next) {
      data = migrate(next);
      persist();
    },
  };
}

function load(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    // Keep unreadable data aside instead of overwriting it on the next save.
    storage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw);
    return defaultData();
  }
}

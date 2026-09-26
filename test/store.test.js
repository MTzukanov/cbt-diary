import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, migrate, defaultData, STORAGE_KEY, clampIntensity, sortedEntries } from '../js/store.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()],
  };
}

test('empty storage gives default data with the five built-in fields', () => {
  const store = createStore(memoryStorage());
  assert.deepEqual(
    store.data.settings.fields.map((f) => f.id),
    ['situation', 'thoughts', 'emotions', 'reactions', 'conclusions'],
  );
  assert.equal(store.data.entries.length, 0);
});

test('saved entries survive a reload', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  store.saveEntry({
    datetime: '2026-09-26T09:30',
    values: { situation: 'Woke up', thoughts: 'Life is good' },
    emotions: [{ key: 'joy', intensity: 8 }, { name: 'anticipation', intensity: 6 }],
  });

  const reloaded = createStore(storage);
  assert.equal(reloaded.data.entries.length, 1);
  const e = reloaded.data.entries[0];
  assert.equal(e.values.situation, 'Woke up');
  assert.deepEqual(e.emotions, [{ key: 'joy', intensity: 8 }, { name: 'anticipation', intensity: 6 }]);
  assert.ok(e.id && e.createdAt && e.updatedAt);
});

test('editing keeps createdAt and bumps updatedAt', async () => {
  const store = createStore(memoryStorage());
  store.saveEntry({ datetime: '2026-09-26T09:30', values: { situation: 'a' } });
  const { id, createdAt, updatedAt } = store.data.entries[0];
  await new Promise((r) => setTimeout(r, 5));
  store.saveEntry({ ...store.getEntry(id), values: { situation: 'b' } });
  const e = store.getEntry(id);
  assert.equal(store.data.entries.length, 1);
  assert.equal(e.values.situation, 'b');
  assert.equal(e.createdAt, createdAt);
  assert.notEqual(e.updatedAt, updatedAt);
});

test('deleteEntry removes the entry', () => {
  const store = createStore(memoryStorage());
  store.saveEntry({ datetime: '2026-09-26T09:30' });
  store.deleteEntry(store.data.entries[0].id);
  assert.equal(store.data.entries.length, 0);
});

test('corrupt JSON is kept aside, not overwritten', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{not json' });
  const store = createStore(storage);
  assert.deepEqual(store.data, defaultData());
  const backup = storage.keys().find((k) => k.startsWith(`${STORAGE_KEY}:corrupt:`));
  assert.equal(storage.getItem(backup), '{not json');
});

test('migrate restores missing built-in fields and keeps custom ones in order', () => {
  const data = migrate({
    settings: {
      fields: [
        { id: 'f_custom', type: 'text', label: 'Body scan' },
        { id: 'thoughts', type: 'text', hidden: true },
        { id: 'thoughts', type: 'text' },
      ],
    },
  });
  const ids = data.settings.fields.map((f) => f.id);
  assert.deepEqual(ids, ['f_custom', 'thoughts', 'situation', 'emotions', 'reactions', 'conclusions']);
  assert.equal(data.settings.fields[0].builtin, false);
  assert.equal(data.settings.fields[1].hidden, true);
});

test('intensity is clamped to 0-10 integers', () => {
  assert.equal(clampIntensity(12), 10);
  assert.equal(clampIntensity(-1), 0);
  assert.equal(clampIntensity('7.6'), 8);
  assert.equal(clampIntensity('x'), 5);
});

test('sortedEntries puts the newest first', () => {
  const list = sortedEntries([
    { datetime: '2026-09-01T10:00', createdAt: '1' },
    { datetime: '2026-09-03T08:00', createdAt: '2' },
    { datetime: '2026-09-02T23:00', createdAt: '3' },
  ]);
  assert.deepEqual(list.map((e) => e.datetime), ['2026-09-03T08:00', '2026-09-02T23:00', '2026-09-01T10:00']);
});

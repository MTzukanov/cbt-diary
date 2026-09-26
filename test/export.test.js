import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toJSON, toPlainText, parseImport, mergeData, exportFileName } from '../js/export.js';
import { defaultData, normalizeEntry } from '../js/store.js';
import { setLang } from '../js/i18n.js';

function sample() {
  const data = defaultData();
  data.settings.fields.push({ id: 'f_body', type: 'text', builtin: false, hidden: false, label: 'Body scan' });
  data.settings.fields.find((f) => f.id === 'conclusions').hidden = true;
  data.entries = [
    normalizeEntry({
      id: 'b', datetime: '2026-09-26T21:00', updatedAt: '2026-09-26T21:00:00Z',
      values: { situation: 'Watched a show', conclusions: 'Suggest my own plan' },
      emotions: [{ key: 'dissatisfaction', intensity: 7 }],
    }),
    normalizeEntry({
      id: 'a', datetime: '2026-09-26T08:00', updatedAt: '2026-09-26T08:00:00Z',
      values: { situation: 'Breakfast', f_body: 'Butterflies' },
      emotions: [{ key: 'joy', intensity: 8 }, { name: 'anticipation', intensity: 6 }],
    }),
  ];
  return data;
}

test('JSON export round-trips through import', () => {
  const data = sample();
  const parsed = parseImport(JSON.parse(toJSON(data)));
  assert.deepEqual(parsed, data);
});

test('import rejects files that are not exports', () => {
  assert.equal(parseImport({ hello: 1 }), null);
  assert.equal(parseImport(null), null);
});

test('plain text lists entries oldest first with translated labels, including hidden fields with text', () => {
  setLang('en');
  const text = toPlainText(sample(), new Date('2026-09-27T10:00'));
  assert.ok(text.indexOf('Breakfast') < text.indexOf('Watched a show'));
  assert.match(text, /Emotions: joy 8\/10, anticipation 6\/10/);
  assert.match(text, /Body scan:\nButterflies/);
  assert.match(text, /Conclusions:\nSuggest my own plan/);
  assert.doesNotMatch(text, /Thoughts:/);

  setLang('ru');
  assert.match(toPlainText(sample()), /Эмоции: радость 8\/10/);
  setLang('en');
});

test('merge adds new entries, keeps newer edits and adds missing custom fields and emotions', () => {
  const current = sample();
  current.settings.fields = current.settings.fields.filter((f) => f.id !== 'f_body');

  const incoming = sample();
  incoming.entries[0].values.situation = 'Edited on phone';
  incoming.entries[0].updatedAt = '2026-09-27T09:00:00Z';
  incoming.entries[1].values.situation = 'Older copy';
  incoming.entries[1].updatedAt = '2026-09-01T00:00:00Z';
  incoming.entries.push(normalizeEntry({ id: 'c', datetime: '2026-09-27T09:00' }));
  incoming.settings.customEmotions = ['Anticipation'];
  current.settings.customEmotions = ['anticipation'];

  const { data, added, updated } = mergeData(current, incoming);
  assert.equal(added, 1);
  assert.equal(updated, 1);
  assert.equal(data.entries.find((e) => e.id === 'b').values.situation, 'Edited on phone');
  assert.equal(data.entries.find((e) => e.id === 'a').values.situation, 'Breakfast');
  assert.ok(data.settings.fields.some((f) => f.id === 'f_body'));
  assert.deepEqual(data.settings.customEmotions, ['anticipation']);
  assert.equal(current.entries.length, 2, 'input is not mutated');
});

test('export file name uses the local date', () => {
  assert.equal(exportFileName('json', new Date(2026, 0, 5)), 'cbt-diary-2026-01-05.json');
});

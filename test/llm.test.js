import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, parseLlmResponse, addEntries, newEmotionNames, FORMAT } from '../js/llm.js';
import { defaultData, normalizeEntry } from '../js/store.js';
import { setLang } from '../js/i18n.js';

const NOW = new Date(2026, 8, 26, 10, 30);

function sample() {
  const data = defaultData();
  data.settings.fields.push({ id: 'f_body', type: 'text', builtin: false, hidden: false, label: 'Body scan' });
  data.settings.fields.find((f) => f.id === 'conclusions').hidden = true;
  data.settings.customEmotions = ['Anticipation'];
  data.entries = [
    normalizeEntry({ id: 'a', datetime: '2026-09-25T19:30', values: { situation: 'Missed the bus' } }),
  ];
  return data;
}

function reply(entries) {
  return JSON.stringify({ format: FORMAT, entries });
}

test('the prompt lists visible fields, emotions, the current time and the language', () => {
  setLang('ru');
  const prompt = buildPrompt(sample().settings, 'ru', NOW);
  assert.match(prompt, /Speak Russian/);
  assert.match(prompt, /Saturday, 2026-09-26T10:30/);
  assert.match(prompt, /- situation: "Ситуация" - What happened\?/);
  assert.match(prompt, /- f_body: "Body scan"/);
  assert.doesNotMatch(prompt, /- conclusions:|"conclusions"/);
  assert.match(prompt, /anxiety \(тревога\)/);
  assert.match(prompt, /My own emotions, use them as written: Anticipation\./);
  assert.match(prompt, /```json\n\{\n {2}"format": "cbt-diary\/v1"/);
  setLang('en');
});

test('the prompt leaves out emotions when that field is hidden', () => {
  setLang('en');
  const settings = sample().settings;
  settings.fields.find((f) => f.id === 'emotions').hidden = true;
  const prompt = buildPrompt(settings, 'en', NOW);
  assert.doesNotMatch(prompt, /intensity|Emotions:/);
});

test('finds the JSON block inside a chat reply', () => {
  const text = `Here is your entry:\n\n\`\`\`json\n${reply([{ datetime: '2026-09-26T08:00', situation: 'Late for work' }])}\n\`\`\`\n\nTake care!`;
  const { entries } = parseLlmResponse(text, sample(), NOW);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].entry, { datetime: '2026-09-26T08:00', values: { situation: 'Late for work' }, emotions: [] });
  assert.deepEqual(entries[0].warnings, []);
});

test('accepts bare JSON, a bare array, trailing commas and typographic quotes', () => {
  const data = sample();
  assert.equal(parseLlmResponse(reply([{ situation: 'x' }]), data, NOW).entries.length, 1);
  assert.equal(parseLlmResponse('[{"situation": "x"}, {"situation": "y"}]', data, NOW).entries.length, 2);
  assert.equal(parseLlmResponse('{"entries": [{"situation": "x",},],}', data, NOW).entries.length, 1);
  assert.equal(parseLlmResponse('{“entries”: [{“situation”: “x”}]}', data, NOW).entries.length, 1);
});

test('reports text without entries', () => {
  const data = sample();
  assert.deepEqual(parseLlmResponse('Sorry, what happened?', data, NOW), { error: 'noData' });
  assert.deepEqual(parseLlmResponse('{"entries": []}', data, NOW), { error: 'noData' });
  assert.deepEqual(parseLlmResponse('{"entries": [{"datetime": "2026-09-26T08:00"}]}', data, NOW), { error: 'noData' });
  assert.deepEqual(parseLlmResponse('', data, NOW), { error: 'noData' });
});

test('maps emotions to presets in any language, to own emotions, or keeps them as new', () => {
  const { entries } = parseLlmResponse(
    reply([{
      situation: 'x',
      emotions: [
        { emotion: 'anxiety', intensity: 7 },
        { emotion: 'Тревога', intensity: 3 },
        { emotion: 'стыд', intensity: 12 },
        { emotion: 'anticipation', intensity: 4.4 },
        { emotion: 'awe' },
        { emotion: '' },
      ],
    }]),
    sample(),
    NOW,
  );
  assert.deepEqual(entries[0].entry.emotions, [
    { key: 'anxiety', intensity: 7 },
    { key: 'shame', intensity: 10 },
    { name: 'Anticipation', intensity: 4 },
    { name: 'awe', intensity: 5 },
  ]);
});

test('matches fields by id or name, joins lists and flags unknown keys', () => {
  const { entries } = parseLlmResponse(
    reply([{ datetime: '2026-09-26T08:00', Thoughts: 'I am late', 'body scan': ['Tight chest', 'Cold hands'], mood: 'bad' }]),
    sample(),
    NOW,
  );
  assert.deepEqual(entries[0].entry.values, { thoughts: 'I am late', f_body: 'Tight chest\nCold hands' });
  assert.deepEqual(entries[0].warnings, [{ key: 'ai.warn.unknown', vars: { names: 'mood' } }]);
});

test('reads dates, and falls back to now or noon with a warning', () => {
  const data = sample();
  const at = (datetime) => parseLlmResponse(reply([{ datetime, situation: 'x' }]), data, NOW).entries[0];
  assert.equal(at('2026-09-20T07:05:00').entry.datetime, '2026-09-20T07:05');
  assert.equal(at('2026-09-20 07:05').entry.datetime, '2026-09-20T07:05');

  const noTime = at('2026-09-20');
  assert.equal(noTime.entry.datetime, '2026-09-20T12:00');
  assert.deepEqual(noTime.warnings, [{ key: 'ai.warn.noTime' }]);

  for (const bad of [undefined, 'yesterday', '2026-13-45T10:00']) {
    const item = at(bad);
    assert.equal(item.entry.datetime, '2026-09-26T10:30');
    assert.deepEqual(item.warnings, [{ key: 'ai.warn.noDate' }]);
  }

  const utc = new Date(Date.UTC(2026, 8, 20, 7, 5));
  const local = `2026-09-${String(utc.getDate()).padStart(2, '0')}T${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`;
  assert.equal(at('2026-09-20T07:05:00Z').entry.datetime, local);
});

test('flags entries that are already in the diary', () => {
  const { entries } = parseLlmResponse(
    reply([
      { datetime: '2026-09-25T19:30', situation: 'Missed the bus' },
      { datetime: '2026-09-25T19:30', situation: 'Something else' },
    ]),
    sample(),
    NOW,
  );
  assert.deepEqual(entries.map((e) => e.duplicate), [true, false]);
});

test('also reads entries from a full JSON export', () => {
  const data = sample();
  const exported = { app: 'cbt-diary', entries: [{ id: 'z', datetime: '2026-09-01T09:00', values: { situation: 'Old' }, emotions: [{ key: 'joy', intensity: 6 }], createdAt: 'x', updatedAt: 'y' }] };
  const { entries } = parseLlmResponse(JSON.stringify(exported), data, NOW);
  assert.deepEqual(entries[0].entry, { datetime: '2026-09-01T09:00', values: { situation: 'Old' }, emotions: [{ key: 'joy', intensity: 6 }] });
  assert.deepEqual(entries[0].warnings, []);
});

test('adding entries gives them fresh ids and adds new emotion names once', () => {
  const data = sample();
  const incoming = [
    { datetime: '2026-09-26T08:00', values: { situation: 'x' }, emotions: [{ name: 'awe', intensity: 5 }, { name: 'Anticipation', intensity: 2 }] },
    { datetime: '2026-09-26T09:00', values: { situation: 'y' }, emotions: [{ name: 'Awe', intensity: 3 }] },
  ];
  assert.deepEqual(newEmotionNames(incoming, data.settings.customEmotions), ['awe']);

  const result = addEntries(data, incoming, NOW);
  assert.equal(result.entries.length, 3);
  const added = result.entries.slice(1);
  assert.ok(added.every((e) => e.id && e.id !== 'a' && e.createdAt === NOW.toISOString()));
  assert.notEqual(added[0].id, added[1].id);
  assert.deepEqual(result.settings.customEmotions, ['Anticipation', 'awe']);
  assert.equal(data.entries.length, 1, 'input is not mutated');
});

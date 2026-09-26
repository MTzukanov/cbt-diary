import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTS, detectLang, setLang, t } from '../js/i18n.js';

test('every locale has exactly the keys of the English locale', () => {
  const enKeys = Object.keys(DICTS.en).sort();
  for (const [code, dict] of Object.entries(DICTS)) {
    assert.deepEqual(Object.keys(dict).sort(), enKeys, `locale ${code}`);
  }
});

test('plural forms cover each language\'s plural categories', () => {
  for (const [code, dict] of Object.entries(DICTS)) {
    const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== 'object') continue;
      for (const cat of needed) assert.ok(cat in value, `${code} ${key} lacks "${cat}"`);
    }
  }
});

test('detectLang picks the first supported browser language', () => {
  assert.equal(detectLang(['de-DE', 'ru-RU', 'en']), 'ru');
  assert.equal(detectLang(['fi']), 'fi');
  assert.equal(detectLang(['de']), 'en');
  assert.equal(detectLang([]), 'en');
});

test('t falls back to English, then to the key', () => {
  setLang('fi');
  assert.equal(t('nav.settings'), 'Asetukset');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLang('en');
});

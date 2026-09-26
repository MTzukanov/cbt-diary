import en from './locales/en.js';
import uk from './locales/uk.js';
import ru from './locales/ru.js';
import fi from './locales/fi.js';

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'uk', name: 'Українська' },
  { code: 'ru', name: 'Русский' },
  { code: 'fi', name: 'Suomi' },
];

const DICTS = { en, uk, ru, fi };
let lang = 'en';

export function detectLang(preferred = globalThis.navigator?.languages ?? []) {
  for (const tag of preferred) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (DICTS[code]) return code;
  }
  return 'en';
}

export function setLang(code) {
  lang = DICTS[code] ? code : 'en';
  if (globalThis.document) document.documentElement.lang = lang;
}

export function getLang() {
  return lang;
}

// t('key') or t('key', { n: 3 }). A value can be an object of plural forms
// keyed by Intl.PluralRules categories (one, few, many, other).
export function t(key, vars = {}) {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (typeof s === 'object') {
    s = s[new Intl.PluralRules(lang).select(vars.n ?? 0)] ?? s.other;
  }
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

export function hasKey(key) {
  return key in DICTS[lang] || key in en;
}

export { DICTS };

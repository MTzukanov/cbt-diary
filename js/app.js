import { createStore } from './store.js';
import { t, setLang, detectLang } from './i18n.js';
import { html } from './dom.js';
import * as diary from './views/diary.js';
import * as entry from './views/entry.js';
import * as charts from './views/charts.js';
import * as settings from './views/settings.js';
import * as guide from './views/guide.js';

const ICONS = {
  diary: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5z"/><path d="M5 20.5A1.5 1.5 0 0 0 6.5 22H19v-3"/><path d="M9 7h6M9 11h6"/></svg>`,
  charts: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16h16"/><path d="M7 15l4-5 3 3 5-7"/></svg>`,
  guide: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/></svg>`,
  settings: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`,
};

const TABS = [
  { path: '/', label: 'nav.diary', icon: ICONS.diary },
  { path: '/charts', label: 'nav.charts', icon: ICONS.charts },
  { path: '/guide', label: 'nav.guide', icon: ICONS.guide },
  { path: '/settings', label: 'nav.settings', icon: ICONS.settings },
];

// Each view is (ctx, ...params) => { title?, back?, body, mount?(root) }.
const ROUTES = [
  [/^\/$/, diary.list],
  [/^\/new$/, entry.form],
  [/^\/edit\/([\w-]+)$/, entry.form],
  [/^\/charts$/, charts.view],
  [/^\/guide$/, guide.view],
  [/^\/settings$/, settings.view],
];

const store = createStore();
setLang(store.data.settings.lang || detectLang());

const ctx = {
  store,
  go(path) {
    location.hash = '#' + path;
  },
  refresh: () => render(false),
  // Runs a store write; returns false and warns instead of throwing when storage is full.
  save(write) {
    try {
      write();
    } catch (err) {
      if (err?.name !== 'QuotaExceededError') throw err;
      alert(t('error.quota'));
      return false;
    }
    navigator.storage?.persist?.();
    return true;
  },
  setLang(code) {
    store.updateSettings((s) => (s.lang = code));
    setLang(code);
    render(false);
  },
};

const appEl = document.getElementById('app');
const titleEl = document.getElementById('title');
const tabbarEl = document.getElementById('tabbar');

function currentPath() {
  return location.hash.replace(/^#/, '') || '/';
}

function render(scrollTop = true) {
  const path = currentPath();
  const route = ROUTES.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
  if (!route) return ctx.go('/');
  const [match, view] = route;

  const result = view(ctx, ...match.slice(1).map(decodeURIComponent));
  document.title = t('app.title');
  titleEl.textContent = result.title || t('app.title');
  appEl.innerHTML = result.body;
  result.mount?.(appEl);

  const active = TABS.find((tab) => tab.path !== '/' && path.startsWith(tab.path))?.path || '/';
  tabbarEl.innerHTML = TABS.map(
    (tab) => html`<a href="#${tab.path}" aria-current="${tab.path === active ? 'page' : 'false'}">${tab.icon}<span>${t(tab.label)}</span></a>`,
  ).join('');

  if (scrollTop) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

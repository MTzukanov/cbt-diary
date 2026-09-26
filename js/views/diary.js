import { t, getLang } from '../i18n.js';
import { html } from '../dom.js';
import { sortedEntries } from '../store.js';
import { emotionLabel } from '../emotions.js';

export function list(ctx) {
  const { entries, settings } = ctx.store.data;
  const fab = html`<a class="fab" href="#/new" aria-label="${t('entry.new')}">+</a>`;
  if (!entries.length) {
    return {
      body: html`<div class="empty">
          <p class="muted">${t('diary.empty')}</p>
          <a class="btn" href="#/guide">${t('diary.readGuide')}</a>
        </div>${fab}`,
    };
  }

  const textFields = settings.fields.filter((f) => f.type === 'text' && !f.hidden);
  const groups = new Map();
  for (const e of sortedEntries(entries)) {
    const day = e.datetime.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(e);
  }

  return {
    body: html`
      ${[...groups].map(
        ([day, items]) => html`<section class="day">
          <h2 class="day-title">${formatDay(day)}</h2>
          ${items.map((e) => card(e, textFields))}
        </section>`,
      )}
      ${fab}`,
  };
}

function card(e, textFields) {
  const preview = textFields.map((f) => e.values[f.id]).find(Boolean) || '';
  return html`<a class="card entry-card" href="#/edit/${e.id}">
    <span class="entry-time">${e.datetime.slice(11, 16)}</span>
    ${preview && html`<p class="entry-preview">${preview}</p>`}
    ${e.emotions.length > 0 &&
    html`<ul class="tags">
      ${e.emotions.map((em) => html`<li class="tag">${emotionLabel(em)} <b>${em.intensity}</b></li>`)}
    </ul>`}
  </a>`;
}

function formatDay(day) {
  const d = new Date(`${day}T00:00`);
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return new Intl.DateTimeFormat(getLang(), opts).format(d);
}

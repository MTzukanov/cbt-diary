import { t, getLang } from '../i18n.js';
import { html } from '../dom.js';
import en from '../guide/en.js';
import uk from '../guide/uk.js';
import ru from '../guide/ru.js';
import fi from '../guide/fi.js';

export const GUIDES = { en, uk, ru, fi };
const EXAMPLE_FIELDS = ['situation', 'thoughts', 'emotions', 'reactions', 'conclusions'];

export function view() {
  const g = GUIDES[getLang()] || en;
  const item = (it) => (typeof it === 'string' ? it : html`<b>${it.b}</b> ${it.t}`);

  return {
    title: t('nav.guide'),
    body: html`
      <p class="guide-intro">${g.intro}</p>
      ${g.sections.map((s) => html`<section class="card guide">
        <h2>${s.h}</h2>
        ${s.ordered
          ? html`<ol>${s.items.map((it) => html`<li>${item(it)}</li>`)}</ol>`
          : html`<ul>${s.items.map((it) => html`<li>${item(it)}</li>`)}</ul>`}
        ${s.after && html`<p>${s.after}</p>`}
      </section>`)}
      <h2 class="day-title">${g.examplesTitle}</h2>
      ${g.examples.map((ex) => html`<section class="card guide-example">
        <dl>
          ${EXAMPLE_FIELDS.filter((f) => ex[f]).map((f) => html`<dt>${t(`field.${f}`)}</dt><dd>${ex[f]}</dd>`)}
        </dl>
      </section>`)}
      <p class="form-actions"><a class="btn btn-primary" href="#/new">${t('entry.new')}</a></p>`,
  };
}

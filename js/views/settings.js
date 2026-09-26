import { t, getLang, LANGUAGES } from '../i18n.js';
import { html } from '../dom.js';

export function view(ctx) {
  return {
    title: t('nav.settings'),
    body: html`
      <section class="card">
        <label class="field">
          <span class="field-label">${t('settings.language')}</span>
          <select id="lang">
            ${LANGUAGES.map((l) => html`<option value="${l.code}" ${l.code === getLang() ? 'selected' : ''}>${l.name}</option>`)}
          </select>
        </label>
      </section>`,
    mount(root) {
      root.querySelector('#lang').addEventListener('change', (e) => ctx.setLang(e.target.value));
    },
  };
}

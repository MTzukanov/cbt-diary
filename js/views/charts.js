import { t } from '../i18n.js';
import { html } from '../dom.js';

export function view(ctx) {
  return {
    title: t('nav.charts'),
    body: html`<p class="empty muted">${t('charts.empty')}</p>`,
  };
}

import { t } from '../i18n.js';
import { html } from '../dom.js';

export function list(ctx) {
  return {
    body: html`<p class="empty muted">${t('diary.empty')}</p>`,
  };
}

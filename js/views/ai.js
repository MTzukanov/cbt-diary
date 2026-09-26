import { t, getLang } from '../i18n.js';
import { html } from '../dom.js';
import { emotionLabel } from '../emotions.js';
import { fieldLabel } from '../fields.js';
import { formatDateTime } from '../export.js';
import { buildPrompt, parseLlmResponse, addEntries, newEmotionNames } from '../llm.js';

// #/ai: copy a prompt into any AI chat, then paste its JSON reply back and
// review the entries before they are saved.
export function view(ctx) {
  const { store } = ctx;
  const prompt = buildPrompt(store.data.settings, getLang());
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return {
    title: t('ai.title'),
    body: html`
      <section class="card">
        <h2>${t('ai.step1')}</h2>
        <p class="small">${t('ai.step1Note')}</p>
        <div class="button-grid">
          <button class="btn btn-primary ${canShare ? '' : 'span-all'}" id="copy">${t('ai.copy')}</button>
          ${canShare && html`<button class="btn" id="share">${t('ai.share')}</button>`}
        </div>
        <details class="prompt-details">
          <summary>${t('ai.showPrompt')}</summary>
          <pre class="prompt-text" id="prompt">${prompt}</pre>
        </details>
        <p class="muted small">${t('ai.privacy')}</p>
      </section>

      <section class="card">
        <h2>${t('ai.step2')}</h2>
        <p class="small">${t('ai.step2Note')}</p>
        <textarea class="paste-box" id="paste" rows="6" placeholder="${t('ai.pastePlaceholder')}" aria-label="${t('ai.step2')}"></textarea>
        <div class="form-actions">
          <button class="btn" id="check">${t('ai.check')}</button>
        </div>
      </section>

      <div id="preview" aria-live="polite"></div>`,

    mount(root) {
      const copyBtn = root.querySelector('#copy');
      copyBtn.addEventListener('click', async () => {
        if (await copyText(prompt, root)) {
          copyBtn.textContent = t('ai.copied');
          setTimeout(() => (copyBtn.textContent = t('ai.copy')), 2000);
        }
      });

      root.querySelector('#share')?.addEventListener('click', () => {
        navigator.share({ text: prompt }).catch(() => {});
      });

      const previewEl = root.querySelector('#preview');
      root.querySelector('#check').addEventListener('click', () => {
        const result = parseLlmResponse(root.querySelector('#paste').value, store.data);
        showPreview(previewEl, result, ctx);
        previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
  };
}

function showPreview(el, result, ctx) {
  const { store } = ctx;
  if (result.error) {
    el.innerHTML = html`<p class="card import-error">${t('ai.noData')}</p>`;
    return;
  }

  const fields = store.data.settings.fields;
  el.innerHTML = html`
    <p class="small import-summary">${t('ai.found', { n: result.entries.length })}</p>
    ${result.entries.map((item, i) => previewCard(item, i, fields))}
    <p class="small muted" id="new-emotions" hidden></p>
    <div class="form-actions">
      <a class="btn" href="#/">${t('entry.cancel')}</a>
      <button class="btn btn-primary" id="save">${t('ai.save')}</button>
    </div>`;

  const selected = () =>
    [...el.querySelectorAll('[data-i]')].filter((c) => c.checked).map((c) => result.entries[c.dataset.i].entry);

  const update = () => {
    const entries = selected();
    el.querySelector('#save').disabled = !entries.length;
    const names = newEmotionNames(entries, store.data.settings.customEmotions);
    const note = el.querySelector('#new-emotions');
    note.hidden = !names.length;
    note.textContent = t('ai.newEmotions', { names: names.join(', ') });
  };
  el.onchange = update;
  update();

  el.querySelector('#save').addEventListener('click', () => {
    const next = addEntries(store.data, selected());
    if (ctx.save(() => store.replace(next))) ctx.go('/');
  });
}

function previewCard({ entry, warnings, duplicate }, i, fields) {
  const texts = fields.filter((f) => f.type === 'text' && entry.values[f.id]);
  const notes = [...warnings.map((w) => t(w.key, w.vars)), ...(duplicate ? [t('ai.warn.duplicate')] : [])];
  return html`<label class="card import-item">
    <input type="checkbox" data-i="${i}" ${duplicate ? '' : 'checked'}>
    <div class="import-body">
      <span class="entry-time">${formatDateTime(entry.datetime)}</span>
      ${notes.map((n) => html`<p class="import-warn small">${n}</p>`)}
      <dl class="import-fields">
        ${texts.map((f) => html`<dt>${fieldLabel(f)}</dt><dd>${entry.values[f.id]}</dd>`)}
      </dl>
      ${entry.emotions.length > 0 &&
      html`<ul class="tags">
        ${entry.emotions.map((em) => html`<li class="tag">${emotionLabel(em)} <b>${em.intensity}</b></li>`)}
      </ul>`}
    </div>
  </label>`;
}

async function copyText(text, root) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard API (older browsers, plain-http LAN address): show the prompt
    // selected, so it can be copied by hand if execCommand fails too.
    root.querySelector('.prompt-details').open = true;
    selectText(root.querySelector('#prompt'));
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

function selectText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

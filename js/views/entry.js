import { t } from '../i18n.js';
import { html } from '../dom.js';
import { localDateTime, clampIntensity } from '../store.js';
import { PRESET_EMOTIONS, emotionId, emotionLabel } from '../emotions.js';
import { fieldLabel } from '../fields.js';

// Shared by #/new and #/edit/<id>.
export function form(ctx, id) {
  const { store } = ctx;
  const existing = id ? store.getEntry(id) : null;
  if (id && !existing) {
    ctx.go('/');
    return { body: '' };
  }

  const entry = existing
    ? structuredClone(existing)
    : { datetime: localDateTime(new Date()), values: {}, emotions: [] };
  const fields = store.data.settings.fields.filter((f) => !f.hidden);

  const body = html`
    ${!existing && html`<a class="ai-link small" href="#/ai">${t('ai.link')} &rarr;</a>`}
    <form id="entry-form" class="entry-form" autocomplete="off">
      <label class="field card">
        <span class="field-label">${t('field.datetime')}</span>
        <input type="datetime-local" name="datetime" value="${entry.datetime}" required>
      </label>
      ${fields.map((f) =>
        f.type === 'emotions'
          ? html`<div class="field card">
              <span class="field-label">${fieldLabel(f)}</span>
              ${!f.label && html`<span class="field-hint">${t('field.emotions.hint')}</span>`}
              <div id="emotions"></div>
            </div>`
          : html`<label class="field card">
              <span class="field-label">${fieldLabel(f)}</span>
              ${f.builtin && !f.label && html`<span class="field-hint">${t(`field.${f.id}.hint`)}</span>`}
              <textarea name="${f.id}" rows="2">${entry.values[f.id] || ''}</textarea>
            </label>`,
      )}
      <div class="form-actions">
        ${existing && html`<button class="btn btn-danger" type="button" id="delete">${t('entry.delete')}</button><span class="spacer"></span>`}
        <a class="btn" href="#/">${t('entry.cancel')}</a>
        <button class="btn btn-primary" type="submit">${t('entry.save')}</button>
      </div>
    </form>`;

  function mount(root) {
    const formEl = root.querySelector('#entry-form');

    for (const ta of formEl.querySelectorAll('textarea')) {
      autoGrow(ta);
      ta.addEventListener('input', () => autoGrow(ta));
    }

    const emotionsEl = root.querySelector('#emotions');
    if (emotionsEl) mountEmotions(emotionsEl, entry, store);

    root.querySelector('#delete')?.addEventListener('click', () => {
      if (!confirm(t('entry.deleteConfirm'))) return;
      store.deleteEntry(existing.id);
      ctx.go('/');
    });

    formEl.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const data = new FormData(formEl);
      entry.datetime = data.get('datetime');
      for (const f of fields) {
        if (f.type === 'text') entry.values[f.id] = String(data.get(f.id) || '').trim();
      }
      if (ctx.save(() => store.saveEntry(entry))) ctx.go('/');
    });
  }

  return { title: t(existing ? 'entry.edit' : 'entry.new'), body, mount };
}

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
}

// Selected emotions with a 0-10 slider each, then chips to add more.
function mountEmotions(el, entry, store) {
  function render() {
    const selected = new Set(entry.emotions.map(emotionId));
    const options = [
      ...PRESET_EMOTIONS.map((key) => ({ key })),
      ...store.data.settings.customEmotions.map((name) => ({ name })),
    ].filter((e) => !selected.has(emotionId(e)));

    el.innerHTML = html`
      <ul class="emotion-list">
        ${entry.emotions.map(
          (e, i) => html`<li class="emotion-row">
            <span class="emotion-name">${emotionLabel(e)}</span>
            <input type="range" min="0" max="10" step="1" value="${e.intensity}" data-i="${i}"
              aria-label="${emotionLabel(e)}">
            <output class="emotion-value">${e.intensity}</output>
            <button type="button" class="icon-btn" data-remove="${i}" aria-label="${t('emotions.remove')}">&times;</button>
          </li>`,
        )}
      </ul>
      <div class="chips">
        ${options.map(
          (e) => html`<button type="button" class="chip" data-add="${e.key ? 'k' : 'n'}" data-value="${e.key || e.name}">${emotionLabel(e)}</button>`,
        )}
        <button type="button" class="chip chip-own" data-own>${t('emotions.addOwn')}</button>
      </div>`;
  }

  function add(e) {
    if (entry.emotions.some((x) => emotionId(x) === emotionId(e))) return;
    entry.emotions.push({ ...e, intensity: 5 });
    render();
  }

  el.addEventListener('input', (ev) => {
    const i = ev.target.dataset.i;
    if (i === undefined) return;
    entry.emotions[i].intensity = clampIntensity(ev.target.value);
    ev.target.nextElementSibling.textContent = entry.emotions[i].intensity;
  });

  el.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.dataset.remove !== undefined) {
      entry.emotions.splice(Number(btn.dataset.remove), 1);
      render();
    } else if (btn.dataset.add) {
      add(btn.dataset.add === 'k' ? { key: btn.dataset.value } : { name: btn.dataset.value });
    } else if (btn.hasAttribute('data-own')) {
      const name = (prompt(t('emotions.ownPrompt')) || '').trim();
      if (!name) return;
      const preset = PRESET_EMOTIONS.find((key) => emotionLabel({ key }).toLowerCase() === name.toLowerCase());
      if (preset) return add({ key: preset });
      const custom = store.data.settings.customEmotions;
      if (!custom.some((c) => c.toLowerCase() === name.toLowerCase())) custom.push(name);
      add({ name: custom.find((c) => c.toLowerCase() === name.toLowerCase()) });
    }
  });

  render();
}

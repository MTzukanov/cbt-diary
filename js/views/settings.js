import { t, getLang, LANGUAGES } from '../i18n.js';
import { html } from '../dom.js';
import { STORAGE_KEY, newId } from '../store.js';
import { fieldLabel } from '../fields.js';
import { toJSON, toPlainText, parseImport, mergeData, exportFileName, saveFile } from '../export.js';

export function view(ctx) {
  const { store } = ctx;
  const count = store.data.entries.length;

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
      </section>

      <section class="card">
        <h2>${t('settings.fields')}</h2>
        <p class="muted small">${t('settings.fieldsNote')}</p>
        <ul class="field-list" id="fields">
          ${store.data.settings.fields.map((f, i, all) => fieldRow(f, i, all.length))}
        </ul>
        <button class="btn" id="add-field">${t('settings.addField')}</button>
      </section>

      <section class="card">
        <h2>${t('settings.ownEmotions')}</h2>
        <p class="muted small">${t('settings.ownEmotionsNote')}</p>
        ${store.data.settings.customEmotions.length
          ? html`<ul class="tags" id="own-emotions">
              ${store.data.settings.customEmotions.map(
                (name, i) => html`<li class="tag">${name}
                  <button class="tag-remove" data-i="${i}" aria-label="${t('emotions.remove')}">&times;</button></li>`,
              )}
            </ul>`
          : html`<p class="small">${t('settings.ownEmotionsEmpty')}</p>`}
      </section>

      <section class="card">
        <h2>${t('settings.data')}</h2>
        <p class="muted small">${t('settings.dataNote')}</p>
        <p class="small">${t('settings.entries', { n: count })} · ${formatSize(storedBytes())}</p>
        <div class="button-grid">
          <button class="btn" id="export-json" ${count ? '' : 'disabled'}>${t('settings.exportJson')}</button>
          <button class="btn" id="export-text" ${count ? '' : 'disabled'}>${t('settings.exportText')}</button>
          <label class="btn">
            ${t('settings.import')}
            <input type="file" id="import" accept=".json,application/json" hidden>
          </label>
          <button class="btn btn-danger" id="delete-all" ${count ? '' : 'disabled'}>${t('settings.deleteAll')}</button>
        </div>
      </section>`,

    mount(root) {
      root.querySelector('#lang').addEventListener('change', (e) => ctx.setLang(e.target.value));

      mountFields(root, ctx);

      root.querySelector('#own-emotions')?.addEventListener('click', (e) => {
        const i = e.target.closest('[data-i]')?.dataset.i;
        if (i === undefined) return;
        store.updateSettings((s) => s.customEmotions.splice(Number(i), 1));
        ctx.refresh();
      });

      root.querySelector('#export-json').addEventListener('click', () =>
        saveFile(exportFileName('json'), toJSON(store.data), 'application/json'),
      );
      root.querySelector('#export-text').addEventListener('click', () =>
        saveFile(exportFileName('txt'), toPlainText(store.data), 'text/plain'),
      );

      root.querySelector('#import').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        let incoming = null;
        try {
          incoming = parseImport(JSON.parse(await file.text()));
        } catch {
          // falls through to the message below
        }
        if (!incoming) {
          alert(t('settings.importInvalid'));
          return;
        }
        const { data, added, updated } = mergeData(store.data, incoming);
        if (ctx.save(() => store.replace(data))) {
          alert(t('settings.importDone', { added, updated }));
          ctx.refresh();
        }
      });

      root.querySelector('#delete-all').addEventListener('click', () => {
        if (!confirm(t('settings.deleteAllConfirm', { n: count }))) return;
        store.replace({ ...store.data, entries: [] });
        ctx.refresh();
      });
    },
  };
}

function fieldRow(f, i, count) {
  return html`<li class="field-row ${f.hidden ? 'is-hidden' : ''}" data-id="${f.id}">
    <div class="reorder">
      <button class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="${t('settings.moveUp')}">&#8593;</button>
      <button class="icon-btn" data-move="1" ${i === count - 1 ? 'disabled' : ''} aria-label="${t('settings.moveDown')}">&#8595;</button>
    </div>
    <input type="text" class="field-name" value="${fieldLabel(f)}" placeholder="${f.builtin ? t(`field.${f.id}`) : ''}"
      aria-label="${t('settings.fieldName')}">
    <label class="switch" title="${t('settings.show')}">
      <input type="checkbox" data-toggle ${f.hidden ? '' : 'checked'} aria-label="${t('settings.show')}">
      <span></span>
    </label>
    ${f.builtin
      ? html`<span class="icon-btn" aria-hidden="true"></span>`
      : html`<button class="icon-btn" data-delete aria-label="${t('settings.deleteField')}">&times;</button>`}
  </li>`;
}

function mountFields(root, ctx) {
  const { store } = ctx;
  const list = root.querySelector('#fields');
  const find = (el) => {
    const id = el.closest('[data-id]').dataset.id;
    return store.data.settings.fields.findIndex((f) => f.id === id);
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const i = find(btn);
    const fields = store.data.settings.fields;
    if (btn.dataset.move) {
      const j = i + Number(btn.dataset.move);
      store.updateSettings(() => ([fields[i], fields[j]] = [fields[j], fields[i]]));
    } else if (btn.hasAttribute('data-delete')) {
      if (!confirm(t('settings.deleteFieldConfirm', { name: fieldLabel(fields[i]) }))) return;
      store.updateSettings(() => fields.splice(i, 1));
    }
    ctx.refresh();
  });

  list.addEventListener('change', (e) => {
    const field = store.data.settings.fields[find(e.target)];
    if (e.target.matches('[data-toggle]')) {
      store.updateSettings(() => (field.hidden = !e.target.checked));
      e.target.closest('.field-row').classList.toggle('is-hidden', field.hidden);
    } else if (e.target.matches('.field-name')) {
      const name = e.target.value.trim();
      // A built-in field goes back to its translated name when cleared.
      if (field.builtin) {
        store.updateSettings(() => (field.label = name && name !== t(`field.${field.id}`) ? name : null));
      } else if (name) {
        store.updateSettings(() => (field.label = name));
      }
      e.target.value = fieldLabel(field);
    }
  });

  root.querySelector('#add-field').addEventListener('click', () => {
    const label = (prompt(t('settings.newFieldPrompt')) || '').trim();
    if (!label) return;
    store.updateSettings((s) => s.fields.push({ id: newId('f_'), type: 'text', builtin: false, hidden: false, label }));
    ctx.refresh();
  });
}

function storedBytes() {
  try {
    return new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  const kb = Math.max(bytes / 1024, bytes ? 0.1 : 0);
  return new Intl.NumberFormat(getLang(), { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(kb);
}

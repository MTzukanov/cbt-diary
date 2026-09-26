import { t, getLang, LANGUAGES } from '../i18n.js';
import { html } from '../dom.js';
import { STORAGE_KEY } from '../store.js';
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

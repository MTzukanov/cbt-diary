import { t, getLang } from '../i18n.js';
import { html } from '../dom.js';
import { emotionId, emotionLabel } from '../emotions.js';
import { RANGES, periodFor, entriesIn, emotionFrequency, emotionDaily, mountLineChart } from '../chart.js';

const MAX_SERIES = 8;
const DEFAULT_SERIES = 3;

// Kept for the session so switching tabs does not reset the view.
const state = {
  range: '30',
  // emotion id -> palette slot. A slot stays with its emotion while it is selected,
  // so toggling one line never repaints the others.
  selected: new Map(),
  touched: false,
};

const color = (slot) => `var(--series-${slot + 1})`;

export function view(ctx) {
  const all = ctx.store.data.entries.filter((e) => e.emotions.length);
  if (!all.length) {
    return { title: t('nav.charts'), body: html`<p class="empty muted">${t('charts.empty')}</p>` };
  }

  const period = periodFor(state.range, all);
  const entries = entriesIn(all, period);
  const freq = emotionFrequency(entries);

  if (!state.touched) {
    state.selected.clear();
    freq.slice(0, DEFAULT_SERIES).forEach((f, i) => state.selected.set(f.id, i));
  }
  const known = new Map(freq.map((f) => [f.id, f.emotion]));
  for (const e of all) for (const em of e.emotions) if (!known.has(emotionId(em))) known.set(emotionId(em), em);
  for (const id of state.selected.keys()) if (!known.has(id)) state.selected.delete(id);
  // Chips: emotions in this period by frequency, plus any selected ones outside it.
  const chipIds = [...new Set([...freq.map((f) => f.id), ...state.selected.keys()])];

  const series = [...state.selected].map(([id, slot]) => ({
    id,
    label: emotionLabel(known.get(id)),
    color: color(slot),
    points: emotionDaily(entries, id),
  }));

  const body = html`
    <div class="segmented" role="group" aria-label="${t('charts.range')}">
      ${RANGES.map((r) => html`<button type="button" data-range="${r}" aria-pressed="${r === state.range}">${t(`charts.range.${r}`)}</button>`)}
    </div>

    ${!entries.length
      ? html`<p class="empty muted">${t('charts.noData')}</p>`
      : html`<section class="card">
          <h2>${t('charts.intensity')}</h2>
          <p class="muted small">${t('charts.intensityNote')}</p>
          <div class="chips legend">
            ${chipIds.map((id) => {
              const slot = state.selected.get(id);
              return html`<button type="button" class="chip" data-emotion="${id}" aria-pressed="${slot !== undefined}">
                ${slot !== undefined && html`<span class="chart-key" style="--c: ${color(slot)}"></span>`}${emotionLabel(known.get(id))}
              </button>`;
            })}
          </div>
          ${series.length ? html`<div id="intensity-chart"></div>` : html`<p class="muted small">${t('charts.pickEmotions')}</p>`}
          ${series.length > 0 && table(
            [t('charts.date'), ...series.map((s) => s.label)],
            [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort().map((day) => [
              formatFullDay(day),
              ...series.map((s) => s.points.find((p) => p.day === day)?.value ?? ''),
            ]),
          )}
        </section>

        <section class="card">
          <h2>${t('charts.frequency')}</h2>
          <p class="muted small">${t('charts.frequencyNote')}</p>
          <ul class="bars">
            ${freq.map((f) => html`<li class="bar-row">
              <span class="bar-label">${emotionLabel(f.emotion)}</span>
              <span class="bar-track">
                <span class="bar" style="width: ${(f.count / freq[0].count) * 100}%"></span>
                <span class="bar-value"><b>${f.count}</b> <span class="muted">${t('charts.avgValue', { v: formatAvg(f.avg) })}</span></span>
              </span>
            </li>`)}
          </ul>
          ${table(
            [t('charts.emotion'), t('charts.count'), t('charts.average')],
            freq.map((f) => [emotionLabel(f.emotion), f.count, formatAvg(f.avg)]),
          )}
        </section>`}`;

  function mount(root) {
    root.querySelector('.segmented').addEventListener('click', (e) => {
      const r = e.target.closest('[data-range]')?.dataset.range;
      if (r && r !== state.range) {
        state.range = r;
        ctx.refresh();
      }
    });

    root.querySelector('.legend')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-emotion]')?.dataset.emotion;
      if (!id) return;
      state.touched = true;
      if (state.selected.has(id)) {
        state.selected.delete(id);
      } else if (state.selected.size < MAX_SERIES) {
        const used = new Set(state.selected.values());
        let slot = 0;
        while (used.has(slot)) slot++;
        state.selected.set(id, slot);
      } else {
        alert(t('charts.maxSeries', { n: MAX_SERIES }));
        return;
      }
      ctx.refresh();
    });

    const chartEl = root.querySelector('#intensity-chart');
    if (chartEl) mountLineChart(chartEl, { ...period, series, formatDay, formatFullDay });
  }

  return { title: t('nav.charts'), body, mount };
}

function table(head, rows) {
  return html`<details class="chart-table">
    <summary>${t('charts.table')}</summary>
    <div class="table-scroll">
      <table>
        <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
        <tbody>${rows.map((r) => html`<tr>${r.map((c, i) => (i ? html`<td class="num">${c}</td>` : html`<th>${c}</th>`))}</tr>`)}</tbody>
      </table>
    </div>
  </details>`;
}

function formatAvg(v) {
  return new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1 }).format(v);
}

function formatDay(day) {
  return new Intl.DateTimeFormat(getLang(), { day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00`));
}

function formatFullDay(day) {
  return new Intl.DateTimeFormat(getLang(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day}T12:00`));
}

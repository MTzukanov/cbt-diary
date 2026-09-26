// Aggregation helpers (pure, tested under node) and a small SVG line chart.
import { html } from './dom.js';
import { emotionId } from './emotions.js';

const pad = (n) => String(n).padStart(2, '0');

export function localDay(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Noon keeps day arithmetic clear of DST jumps.
export function addDays(day, n) {
  const d = new Date(`${day}T12:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 86400000);
}

export const RANGES = ['7', '30', '90', 'all'];

export function periodFor(range, entries, today = localDay(new Date())) {
  const days = entries.map((e) => e.datetime.slice(0, 10)).sort();
  const end = days.length && days.at(-1) > today ? days.at(-1) : today;
  if (range === 'all') return { start: days[0] && days[0] < end ? days[0] : end, end };
  return { start: addDays(today, -(Number(range) - 1)), end };
}

export function entriesIn(entries, { start, end }) {
  return entries.filter((e) => {
    const day = e.datetime.slice(0, 10);
    return day >= start && day <= end;
  });
}

// How many entries mention each emotion and its average rating, most frequent first.
export function emotionFrequency(entries) {
  const rows = new Map();
  for (const e of entries) {
    for (const em of e.emotions) {
      const id = emotionId(em);
      const row = rows.get(id) ?? { id, emotion: em, count: 0, sum: 0 };
      row.count++;
      row.sum += em.intensity;
      rows.set(id, row);
    }
  }
  return [...rows.values()]
    .map(({ sum, ...row }) => ({ ...row, avg: Math.round((sum / row.count) * 10) / 10 }))
    .sort((a, b) => b.count - a.count || b.avg - a.avg || a.id.localeCompare(b.id));
}

// Highest rating of one emotion per day, oldest first.
export function emotionDaily(entries, id) {
  const byDay = new Map();
  for (const e of entries) {
    for (const em of e.emotions) {
      if (emotionId(em) !== id) continue;
      const day = e.datetime.slice(0, 10);
      byDay.set(day, Math.max(byDay.get(day) ?? 0, em.intensity));
    }
  }
  return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
}

// Peak and average of all emotion ratings per day, oldest first.
export function dailyStats(entries) {
  const byDay = new Map();
  for (const e of entries) {
    const day = e.datetime.slice(0, 10);
    for (const em of e.emotions) {
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(em.intensity);
    }
  }
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, max: Math.max(...v), avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }));
}

// ---- Rendering ----

const HEIGHT = 200;
const TICKS_Y = [0, 2, 4, 6, 8, 10];

// series: [{ id, label, color, points: [{ day, value }] }], values on a 0-10 scale.
// directLabels puts each series' name at its last point when the labels do not collide.
export function mountLineChart(el, { start, end, series, formatDay, formatFullDay, formatValue = String, directLabels = false }) {
  el.classList.add('chart');
  el.tabIndex = 0;
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;

  const dataDays = [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort();
  const valueAt = new Map(series.map((s) => [s.id, new Map(s.points.map((p) => [p.day, p.value]))]));
  let geo = null;
  let active = -1;

  function draw() {
    const width = Math.max(el.clientWidth, 240);
    const m = { top: 10, right: directLabels ? 76 : 14, bottom: 26, left: 26 };
    const w = width - m.left - m.right;
    const h = HEIGHT - m.top - m.bottom;
    const span = daysBetween(start, end);
    const x = (day) => m.left + (span ? (daysBetween(start, day) / span) * w : w / 2);
    const y = (v) => m.top + h - (v / 10) * h;

    const tickCount = Math.min(span + 1, width < 420 ? 4 : 6);
    const xTicks = [...new Set(Array.from({ length: tickCount }, (_, i) =>
      addDays(start, Math.round((i * span) / Math.max(tickCount - 1, 1))),
    ))];

    const labels = [];
    if (directLabels) {
      for (const s of series) {
        const last = s.points.at(-1);
        if (!last) continue;
        const ly = y(last.value);
        if (labels.some((l) => Math.abs(l.y - ly) < 14)) continue;
        labels.push({ x: x(last.day) + 10, y: ly, text: s.label });
      }
    }

    el.innerHTML = html`<svg width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" role="img">
      <g class="chart-grid">
        ${TICKS_Y.map((v) => html`<line x1="${m.left}" x2="${width - m.right}" y1="${y(v)}" y2="${y(v)}"/>
          <text x="${m.left - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${v}</text>`)}
      </g>
      <g class="chart-axis">
        ${xTicks.map((day, i) => html`<text x="${x(day)}" y="${HEIGHT - 6}"
          text-anchor="${xTicks.length > 1 && i === 0 ? 'start' : i === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'}">${formatDay(day)}</text>`)}
      </g>
      <line class="chart-crosshair" y1="${m.top}" y2="${m.top + h}" x1="0" x2="0" visibility="hidden"/>
      ${series.map((s) => html`<g style="--c: ${s.color}">
        ${s.points.length > 1 && html`<path class="chart-line" d="${s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join('')}"/>`}
        ${s.points.map((p) => html`<circle class="chart-dot" cx="${x(p.day)}" cy="${y(p.value)}" r="4"/>`)}
      </g>`)}
      ${labels.map((l) => html`<text class="chart-label" x="${l.x}" y="${l.y}" dominant-baseline="middle">${l.text}</text>`)}
    </svg>`;
    el.append(tip);
    geo = { x, width };
    if (active >= 0) show(active);
  }

  function show(i) {
    active = i;
    const day = dataDays[i];
    const cx = geo.x(day);
    const cross = el.querySelector('.chart-crosshair');
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');

    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'chart-tip-date';
    head.textContent = formatFullDay(day);
    tip.append(head);
    for (const s of series) {
      const v = valueAt.get(s.id).get(day);
      if (v === undefined) continue;
      const row = document.createElement('div');
      row.className = 'chart-tip-row';
      const key = document.createElement('span');
      key.className = 'chart-key';
      key.style.setProperty('--c', s.color);
      const value = document.createElement('b');
      value.textContent = formatValue(v);
      const name = document.createElement('span');
      name.textContent = s.label;
      row.append(key, value, name);
      tip.append(row);
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${cx > geo.width / 2 ? Math.max(0, cx - tw - 12) : Math.min(geo.width - tw, cx + 12)}px`;
  }

  function hide() {
    active = -1;
    tip.hidden = true;
    el.querySelector('.chart-crosshair')?.setAttribute('visibility', 'hidden');
  }

  // The crosshair snaps to the nearest day that has data.
  function nearest(clientX) {
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0;
    dataDays.forEach((day, i) => {
      if (Math.abs(geo.x(day) - px) < Math.abs(geo.x(dataDays[best]) - px)) best = i;
    });
    return best;
  }

  if (dataDays.length) {
    const onPoint = (e) => show(nearest(e.clientX));
    el.addEventListener('pointerdown', onPoint);
    el.addEventListener('pointermove', onPoint);
    el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hide());
    el.addEventListener('blur', hide);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      show(Math.min(dataDays.length - 1, Math.max(0, (active < 0 ? (step > 0 ? -1 : dataDays.length) : active) + step)));
    });
    const outside = (e) => {
      if (!el.isConnected) return document.removeEventListener('pointerdown', outside);
      if (!el.contains(e.target)) hide();
    };
    document.addEventListener('pointerdown', outside);
  }

  let lastWidth = el.clientWidth;
  const ro = new ResizeObserver(() => {
    if (!el.isConnected) return ro.disconnect();
    if (el.clientWidth !== lastWidth) {
      lastWidth = el.clientWidth;
      draw();
    }
  });
  ro.observe(el);
  draw();
}

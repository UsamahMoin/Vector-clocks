const socket = io();

const COLORS = {
  proc:       ['#6c63ff', '#ff6584', '#43e97b'],
  send:       '#fbbf24',
  recv:       '#38bdf8',
  internal:   '#a78bfa',
  bg:         '#0f1117',
  text:       '#e2e8f0',
  muted:      '#718096',
  ancestor:   '#a78bfa',
  concurrent: '#f97316',
  selected:   '#ffffff',
};

const SVG_W  = 620;
const COL_X  = [120, 310, 500];
const TOP_PAD = 72;
const ROW_H  = 80;
const DOT_R  = 10;

let events    = [];
let eventEls  = new Map();   // id → { group, glowRing, concBadge }
let arrowEls  = new Map();   // recv-event-id → path element
let selectedId = null;
let svgHeight  = TOP_PAD + ROW_H;

// ── Vector-clock relations ──────────────────────────────────────────────────

function happensBefore(a, b) {
  return a.every((v, i) => v <= b[i]) && a.some((v, i) => v < b[i]);
}

function ancestors(id) {
  const tgt = events.find(e => e.id === id);
  return new Set(events.filter(e => e.id !== id && happensBefore(e.clock, tgt.clock)).map(e => e.id));
}

function concurrent(id) {
  const tgt = events.find(e => e.id === id);
  return new Set(events.filter(e => {
    if (e.id === id) return false;
    return !happensBefore(e.clock, tgt.clock) && !happensBefore(tgt.clock, e.clock);
  }).map(e => e.id));
}

// ── SVG helpers ─────────────────────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function buildDefs() {
  const defs = svgEl('defs');

  // Arrow marker
  const marker = svgEl('marker', { id: 'arrow-msg', markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: 'auto' });
  marker.appendChild(svgEl('path', { d: 'M0,0 L0,6 L8,3 z', fill: COLORS.send }));
  defs.appendChild(marker);

  // Glow filters
  [['glow-white',  COLORS.selected],
   ['glow-purple', COLORS.ancestor],
   ['glow-orange', COLORS.concurrent]].forEach(([id, color]) => {
    const f = svgEl('filter', { id, x: '-60%', y: '-60%', width: '220%', height: '220%' });
    f.innerHTML = `
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/>
      <feFlood flood-color="${color}" flood-opacity="1" result="clr"/>
      <feComposite in="clr" in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>`;
    defs.appendChild(f);
  });

  return defs;
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initSVG() {
  events = []; eventEls.clear(); arrowEls.clear();
  selectedId = null; svgHeight = TOP_PAD + ROW_H;

  const container = document.getElementById('diagram');
  container.innerHTML = '';

  const svg = svgEl('svg', { id: 'vc-svg', viewBox: `0 0 ${SVG_W} ${svgHeight}`, xmlns: 'http://www.w3.org/2000/svg' });
  svg.appendChild(buildDefs());
  svg.appendChild(svgEl('rect', { id: 'bg-rect', width: SVG_W, height: svgHeight, fill: COLORS.bg, style: 'cursor:default' }));

  // Process column headers + timeline lines
  ['P1','P2','P3'].forEach((lbl, i) => {
    const x = COL_X[i], c = COLORS.proc[i];
    const g = svgEl('g');
    g.appendChild(svgEl('circle', { cx: x, cy: 34, r: 22, fill: c, opacity: 0.1 }));
    g.appendChild(svgEl('circle', { cx: x, cy: 34, r: 15, fill: c, opacity: 0.18 }));
    const t = svgEl('text', { x, y: 39, 'text-anchor': 'middle', fill: c, 'font-size': 13, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif' });
    t.textContent = lbl; g.appendChild(t); svg.appendChild(g);
    svg.appendChild(svgEl('line', { id: `proc-line-${i}`, x1: x, y1: TOP_PAD, x2: x, y2: svgHeight - 20, stroke: c, 'stroke-width': 2, 'stroke-opacity': 0.3 }));
  });

  svg.appendChild(svgEl('g', { id: 'arrows-layer' }));
  svg.appendChild(svgEl('g', { id: 'events-layer' }));

  svg.addEventListener('click', e => { if (e.target === svg || e.target.id === 'bg-rect') clearHighlight(); });
  container.appendChild(svg);
  clearInfo();
}

// ── Append events ─────────────────────────────────────────────────────────

function appendEvents(newEvs) {
  const svg      = document.getElementById('vc-svg');
  const evLayer  = document.getElementById('events-layer');
  const arrLayer = document.getElementById('arrows-layer');

  newEvs.forEach(ev => {
    events.push(ev);
    const idx   = events.filter(e => e.proc === ev.proc).length - 1;
    const y     = TOP_PAD + (idx + 1) * ROW_H;
    const x     = COL_X[ev.proc];
    const kClr  = ev.kind === 'send' ? COLORS.send : ev.kind === 'recv' ? COLORS.recv : COLORS.internal;
    const pClr  = COLORS.proc[ev.proc];

    const g = svgEl('g', { 'data-id': ev.id, opacity: 0, style: 'cursor:pointer' });

    // Glow ring — hidden until highlight
    const glowRing = svgEl('circle', { cx: x, cy: y, r: DOT_R + 10, fill: 'none', stroke: 'transparent', 'stroke-width': 3, opacity: 0 });
    g.appendChild(glowRing);

    // Concurrency badge (small orange dot, top-right of event)
    const concBadge = svgEl('circle', { cx: x + DOT_R - 1, cy: y - DOT_R + 1, r: 4.5, fill: COLORS.concurrent, opacity: 0, 'stroke': COLORS.bg, 'stroke-width': 1.5 });
    g.appendChild(concBadge);

    // Main dot
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: DOT_R, fill: kClr, stroke: pClr, 'stroke-width': 2 }));

    // Kind glyph
    const glyph = svgEl('text', { x, y: y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 9, 'font-weight': 700, 'font-family': 'Inter,sans-serif', style: 'pointer-events:none' });
    glyph.textContent = ev.kind === 'send' ? '↑' : ev.kind === 'recv' ? '↓' : '·';
    g.appendChild(glyph);

    // VC label — left of P2/P3, right of P1
    const lx     = ev.proc === 0 ? x + 16 : x - 16;
    const anchor = ev.proc === 0 ? 'start'  : 'end';
    const lbl = svgEl('text', { x: lx, y: y + 4, 'text-anchor': anchor, fill: COLORS.text, 'font-size': 10, 'font-family': '"JetBrains Mono",monospace', style: 'pointer-events:none' });
    lbl.textContent = `[${ev.clock.join(',')}]`;
    g.appendChild(lbl);

    g.addEventListener('click', e => { e.stopPropagation(); selectedId === ev.id ? clearHighlight() : applyHighlight(ev.id); });
    evLayer.appendChild(g);
    eventEls.set(ev.id, { group: g, glowRing, concBadge });

    requestAnimationFrame(() => { g.style.transition = 'opacity 0.35s ease'; g.setAttribute('opacity', 1); });

    // Bezier message arrow for recv events
    if (ev.kind === 'recv' && ev.linked_to != null) {
      const src = events.find(e => e.id === ev.linked_to);
      if (src) {
        const si = events.filter(e => e.proc === src.proc).length - 1;
        const sy = TOP_PAD + (si + 1) * ROW_H;
        arrowEls.set(ev.id, drawArrow(arrLayer, COL_X[src.proc], sy, x, y));
      }
    }
  });

  // Grow SVG canvas
  const maxRows = Math.max(...[0,1,2].map(p => events.filter(e => e.proc === p).length));
  const needed  = TOP_PAD + (maxRows + 1.5) * ROW_H;
  if (needed > svgHeight) {
    svgHeight = needed;
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${svgHeight}`);
    document.getElementById('bg-rect').setAttribute('height', svgHeight);
    [0,1,2].forEach(i => { const l = document.getElementById(`proc-line-${i}`); if (l) l.setAttribute('y2', svgHeight - 20); });
  }

  refreshConcurrencyBadges();
  if (selectedId != null) applyHighlight(selectedId);  // re-apply if active
}

// ── Bezier arrow ──────────────────────────────────────────────────────────

function drawArrow(layer, x1, y1, x2, y2) {
  const cpY = (y1 + y2) / 2;
  const dx  = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  // Pull endpoint back so arrowhead tip sits on dot edge
  const ex  = x2 - (dx/len) * (DOT_R + 6);
  const ey  = y2 - (dy/len) * (DOT_R + 6);
  const d   = `M ${x1} ${y1} C ${x1} ${cpY} ${x2} ${cpY} ${ex} ${ey}`;

  const path = svgEl('path', { d, fill: 'none', stroke: COLORS.send, 'stroke-width': 1.8, 'stroke-dasharray': '6,3', 'marker-end': 'url(#arrow-msg)', opacity: 0 });
  layer.appendChild(path);
  requestAnimationFrame(() => { path.style.transition = 'opacity 0.5s ease 0.2s'; path.setAttribute('opacity', 0.9); });
  return path;
}

// ── Concurrency badges ────────────────────────────────────────────────────

function refreshConcurrencyBadges() {
  events.forEach(ev => {
    const c   = concurrent(ev.id);
    const els = eventEls.get(ev.id);
    if (els) els.concBadge.setAttribute('opacity', c.size > 0 ? 1 : 0);
  });
}

// ── Highlighting ──────────────────────────────────────────────────────────

function applyHighlight(id) {
  selectedId = id;
  const ancs = ancestors(id);
  const conc = concurrent(id);

  eventEls.forEach(({ group, glowRing }, evId) => {
    if (evId === id) {
      group.setAttribute('opacity', 1);
      group.setAttribute('filter', 'url(#glow-white)');
      glowRing.setAttribute('stroke', COLORS.selected);
      glowRing.setAttribute('opacity', 0.55);
    } else if (ancs.has(evId)) {
      group.setAttribute('opacity', 1);
      group.setAttribute('filter', 'url(#glow-purple)');
      glowRing.setAttribute('stroke', COLORS.ancestor);
      glowRing.setAttribute('opacity', 0.45);
    } else if (conc.has(evId)) {
      group.setAttribute('opacity', 1);
      group.setAttribute('filter', 'url(#glow-orange)');
      glowRing.setAttribute('stroke', COLORS.concurrent);
      glowRing.setAttribute('opacity', 0.45);
    } else {
      group.setAttribute('opacity', 0.12);
      group.removeAttribute('filter');
      glowRing.setAttribute('opacity', 0);
    }
  });

  arrowEls.forEach((path, recvId) => {
    const recv = events.find(e => e.id === recvId);
    const send = recv ? events.find(e => e.id === recv.linked_to) : null;
    const keep = recvId === id || send?.id === id || ancs.has(recvId) || (send && ancs.has(send.id));
    path.setAttribute('opacity', keep ? 0.9 : 0.06);
  });

  showInfo(id, ancs.size, conc.size);
}

function clearHighlight() {
  selectedId = null;
  eventEls.forEach(({ group, glowRing }) => {
    group.setAttribute('opacity', 1);
    group.removeAttribute('filter');
    glowRing.setAttribute('opacity', 0);
  });
  arrowEls.forEach(p => p.setAttribute('opacity', 0.9));
  clearInfo();
}

// ── Info panel ────────────────────────────────────────────────────────────

function showInfo(id, ancCount, concCount) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  const kinds = { send: 'Send', recv: 'Receive', internal: 'Internal' };
  document.querySelector('#info-panel .ip-proc').textContent  = `P${ev.proc + 1} · ${kinds[ev.kind]}`;
  document.querySelector('#info-panel .ip-clock').textContent = `[${ev.clock.join(', ')}]`;
  document.querySelector('#info-panel .ip-ancs').textContent  = `${ancCount} causal ancestor${ancCount !== 1 ? 's' : ''}`;
  document.querySelector('#info-panel .ip-conc').textContent  = `${concCount} concurrent event${concCount !== 1 ? 's' : ''}`;
  document.getElementById('info-panel').classList.remove('hidden');
}

function clearInfo() {
  document.getElementById('info-panel').classList.add('hidden');
}

// ── Clock cards ───────────────────────────────────────────────────────────

function updateClockCards(clocks) {
  [[0,'p1'],[1,'p2'],[2,'p3']].forEach(([i, cls]) => {
    const cells = document.querySelectorAll(`.clock-card.${cls} .clock-cell`);
    clocks[i].forEach((val, j) => {
      const old = parseInt(cells[j].textContent);
      cells[j].textContent = val;
      if (val !== old) {
        cells[j].classList.remove('highlight');
        void cells[j].offsetWidth;
        cells[j].classList.add('highlight');
        setTimeout(() => cells[j].classList.remove('highlight'), 800);
      }
    });
  });
}

function addLogEntry(ev) {
  const log   = document.getElementById('event-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${ev.kind}`;
  entry.textContent = `P${ev.proc + 1} ${ev.kind.toUpperCase()} → [${ev.clock.join(',')}]`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ── Socket ────────────────────────────────────────────────────────────────

socket.on('new_events', ({ events: newEvs, clocks }) => {
  appendEvents(newEvs);
  updateClockCards(clocks);
  newEvs.forEach(addLogEntry);
});

socket.on('reset', () => {
  initSVG();
  document.querySelectorAll('.clock-cell').forEach(c => c.textContent = '0');
  document.getElementById('event-log').innerHTML = '';
});

// ── Controls ──────────────────────────────────────────────────────────────

document.getElementById('send-btn').addEventListener('click', () => {
  socket.emit('send_message', {
    sender:   parseInt(document.getElementById('sender').value),
    receiver: parseInt(document.getElementById('receiver').value),
  });
});

document.getElementById('reset-btn').addEventListener('click', () => fetch('/api/reset', { method: 'POST' }));

document.getElementById('info-panel').querySelector('.ip-close').addEventListener('click', clearHighlight);

document.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat) document.getElementById('send-btn').click(); });

initSVG();

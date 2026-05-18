/* ── Vector Clock Visualizer ── */
const socket = io();

const COLORS = {
  proc: ['#6c63ff', '#ff6584', '#43e97b'],
  send: '#fbbf24',
  recv: '#38bdf8',
  internal: '#a78bfa',
  bg: '#0f1117',
  grid: '#2a2d3e',
  text: '#e2e8f0',
  muted: '#718096',
};

const SVG_W = 620;
const COL_X = [120, 310, 500];
const TOP_PAD = 60;
const ROW_H = 70;
const DOT_R = 9;

let events = [];
let svgHeight = TOP_PAD + ROW_H;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function initSVG() {
  const container = document.getElementById('diagram');
  container.innerHTML = '';
  const svg = svgEl('svg', {
    id: 'vc-svg',
    viewBox: `0 0 ${SVG_W} ${svgHeight}`,
    xmlns: 'http://www.w3.org/2000/svg',
  });

  // Arrow marker defs
  const defs = svgEl('defs');
  ['send', 'recv'].forEach(kind => {
    const color = COLORS[kind];
    const marker = svgEl('marker', {
      id: `arrow-${kind}`,
      markerWidth: 8, markerHeight: 8,
      refX: 6, refY: 3,
      orient: 'auto',
    });
    const path = svgEl('path', {
      d: 'M0,0 L0,6 L8,3 z',
      fill: color,
    });
    marker.appendChild(path);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  // Background
  svg.appendChild(svgEl('rect', { width: SVG_W, height: svgHeight, fill: COLORS.bg }));

  // Process columns
  ['P1', 'P2', 'P3'].forEach((label, i) => {
    const x = COL_X[i];
    const color = COLORS.proc[i];

    // Column header circle
    const headerG = svgEl('g');
    headerG.appendChild(svgEl('circle', { cx: x, cy: 28, r: 18, fill: color, opacity: 0.15 }));
    headerG.appendChild(svgEl('circle', { cx: x, cy: 28, r: 14, fill: color, opacity: 0.25 }));
    const labelEl = svgEl('text', {
      x, y: 33, 'text-anchor': 'middle', fill: color,
      'font-size': 13, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif',
    });
    labelEl.textContent = label;
    headerG.appendChild(labelEl);
    svg.appendChild(headerG);

    // Vertical line (will be updated on resize)
    svg.appendChild(svgEl('line', {
      id: `proc-line-${i}`,
      x1: x, y1: TOP_PAD, x2: x, y2: svgHeight - 20,
      stroke: color, 'stroke-width': 2, 'stroke-opacity': 0.4,
    }));
  });

  svg.appendChild(svgEl('g', { id: 'events-layer' }));
  svg.appendChild(svgEl('g', { id: 'arrows-layer' }));

  container.appendChild(svg);
}

function getEventY(index) {
  return TOP_PAD + (index + 1) * ROW_H;
}

function procEventIndex(proc) {
  return events.filter(e => e.proc === proc);
}

function appendEvents(newEvs) {
  const svg = document.getElementById('vc-svg');
  const evLayer = document.getElementById('events-layer');
  const arrowLayer = document.getElementById('arrows-layer');

  // Track per-proc counts before this batch
  const procCount = [0, 1, 2].map(p => events.filter(e => e.proc === p && !newEvs.includes(e)).length);

  newEvs.forEach(ev => {
    events.push(ev);
    const idx = events.filter(e => e.proc === ev.proc).length - 1;
    const y = TOP_PAD + (idx + 1) * ROW_H;
    const x = COL_X[ev.proc];
    const color = ev.kind === 'send' ? COLORS.send : ev.kind === 'recv' ? COLORS.recv : COLORS.internal;
    const procColor = COLORS.proc[ev.proc];

    // Dot group
    const g = svgEl('g', { class: 'event-group', opacity: 0 });
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: DOT_R + 4, fill: procColor, opacity: 0.15 }));
    g.appendChild(svgEl('circle', { cx: x, cy: y, r: DOT_R, fill: color, stroke: procColor, 'stroke-width': 2 }));

    // Kind icon (text)
    const icon = svgEl('text', {
      x, y: y + 4, 'text-anchor': 'middle',
      fill: '#fff', 'font-size': 9, 'font-weight': 700,
      'font-family': 'Inter, system-ui, sans-serif',
    });
    icon.textContent = ev.kind === 'send' ? '↑' : ev.kind === 'recv' ? '↓' : '•';
    g.appendChild(icon);

    // Vector clock label
    const vcStr = `[${ev.clock.join(',')}]`;
    const labelX = ev.proc === 1 ? x + 18 : x - 18;
    const anchor = ev.proc === 1 ? 'start' : 'end';
    const lbl = svgEl('text', {
      x: labelX, y: y + 4, 'text-anchor': anchor,
      fill: COLORS.text, 'font-size': 10,
      'font-family': '"JetBrains Mono", monospace',
    });
    lbl.textContent = vcStr;
    g.appendChild(lbl);

    evLayer.appendChild(g);

    // Animate in
    requestAnimationFrame(() => {
      g.style.transition = 'opacity 0.4s ease';
      g.setAttribute('opacity', 1);
    });

    // Arrow for recv events
    if (ev.kind === 'recv' && ev.linked_to !== null && ev.linked_to !== undefined) {
      const sendEv = events.find(e => e.id === ev.linked_to);
      if (sendEv) {
        const sendIdx = events.filter(e => e.proc === sendEv.proc).length - 1;
        const sy = TOP_PAD + (sendIdx + 1) * ROW_H;
        const sx = COL_X[sendEv.proc];
        drawArrow(arrowLayer, sx, sy, x, y);
      }
    }
  });

  // Expand SVG height if needed
  const maxEvents = Math.max(...[0,1,2].map(p => events.filter(e => e.proc === p).length));
  const needed = TOP_PAD + (maxEvents + 1.5) * ROW_H;
  if (needed > svgHeight) {
    svgHeight = needed;
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${svgHeight}`);
    svg.querySelector('rect').setAttribute('height', svgHeight);
    [0,1,2].forEach(i => {
      const line = document.getElementById(`proc-line-${i}`);
      if (line) line.setAttribute('y2', svgHeight - 20);
    });
  }
}

function drawArrow(layer, x1, y1, x2, y2) {
  const kind = x2 > x1 ? 'send' : 'recv';
  // Adjust end point so arrow doesn't overlap dot
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const nx = dx/len, ny = dy/len;
  const ex = x2 - nx * (DOT_R + 5);
  const ey = y2 - ny * (DOT_R + 5);

  const line = svgEl('line', {
    x1, y1, x2: ex, y2: ey,
    stroke: COLORS.send,
    'stroke-width': 1.5,
    'stroke-dasharray': '6,3',
    'marker-end': `url(#arrow-send)`,
    opacity: 0,
  });
  layer.appendChild(line);
  requestAnimationFrame(() => {
    line.style.transition = 'opacity 0.5s ease 0.2s';
    line.setAttribute('opacity', 0.85);
  });
}

function updateClockCards(clocks) {
  [[0,'p1'],[1,'p2'],[2,'p3']].forEach(([i, cls]) => {
    const card = document.querySelector(`.clock-card.${cls}`);
    if (!card) return;
    const cells = card.querySelectorAll('.clock-cell');
    clocks[i].forEach((val, j) => {
      const oldVal = parseInt(cells[j].textContent);
      cells[j].textContent = val;
      if (val !== oldVal) {
        cells[j].classList.remove('highlight');
        void cells[j].offsetWidth;
        cells[j].classList.add('highlight');
        setTimeout(() => cells[j].classList.remove('highlight'), 800);
      }
    });
  });
}

function addLogEntry(ev) {
  const log = document.getElementById('event-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${ev.kind}`;
  const proc = `P${ev.proc + 1}`;
  const vc = `[${ev.clock.join(',')}]`;
  entry.textContent = `${proc} ${ev.kind.toUpperCase()} → ${vc}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// Socket events
socket.on('new_events', ({ events: newEvs, clocks }) => {
  appendEvents(newEvs);
  updateClockCards(clocks);
  newEvs.forEach(addLogEntry);
});

socket.on('reset', () => {
  events = [];
  svgHeight = TOP_PAD + ROW_H;
  initSVG();
  document.querySelectorAll('.clock-cell').forEach(c => c.textContent = '0');
  document.getElementById('event-log').innerHTML = '';
});

// UI controls
document.getElementById('send-btn').addEventListener('click', () => {
  const s = parseInt(document.getElementById('sender').value);
  const r = parseInt(document.getElementById('receiver').value);
  socket.emit('send_message', { sender: s, receiver: r });
});

document.getElementById('reset-btn').addEventListener('click', () => {
  fetch('/api/reset', { method: 'POST' });
});

// Keyboard shortcut: Enter to send
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.repeat) document.getElementById('send-btn').click();
});

// Init
initSVG();

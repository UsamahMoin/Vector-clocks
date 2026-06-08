const PROCESS_COUNT = 3;
const ANIMATION_MS = 900;

let clocks = createEmptyClocks();
let events = [];
let selectedSource = 0;
let selectedTarget = 1;
let busy = false;
let demoRun = 0;

const sourceButtons = [...document.querySelectorAll("[data-source]")];
const targetButtons = [...document.querySelectorAll("[data-target]")];
const processNodes = [...document.querySelectorAll("[data-process]")];
const networkLinks = [...document.querySelectorAll("[data-link]")];
const localEventButton = document.querySelector("#local-event");
const sendMessageButton = document.querySelector("#send-message");
const resetButton = document.querySelector("#reset-simulation");
const causalDemoButton = document.querySelector("#causal-demo");
const concurrentDemoButton = document.querySelector("#concurrent-demo");
const networkStage = document.querySelector("#network-stage");
const networkStatus = document.querySelector("#network-status");
const eventCounter = document.querySelector("#event-counter");
const eventLog = document.querySelector("#event-log");
const messagePacket = document.querySelector("#message-packet");
const packetClock = document.querySelector("#packet-clock");
const comparisonA = document.querySelector("#comparison-a");
const comparisonB = document.querySelector("#comparison-b");
const comparisonMark = document.querySelector("#comparison-mark");
const comparisonResult = document.querySelector("#comparison-result");

function createEmptyClocks() {
  return Array.from({ length: PROCESS_COUNT }, () => Array(PROCESS_COUNT).fill(0));
}

function processName(index) {
  return `P${index + 1}`;
}

function formatClock(clock) {
  return `[${clock.join(",")}]`;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function setStatus(message) {
  networkStatus.textContent = message;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  localEventButton.disabled = nextBusy;
  sendMessageButton.disabled = nextBusy;
  resetButton.disabled = nextBusy;
  causalDemoButton.disabled = nextBusy;
  concurrentDemoButton.disabled = nextBusy;
}

function setSource(index) {
  if (busy) return;

  selectedSource = index;
  if (selectedTarget === selectedSource) {
    selectedTarget = [0, 1, 2].find((candidate) => candidate !== selectedSource);
  }
  renderSelection();
}

function setTarget(index) {
  if (busy || index === selectedSource) return;
  selectedTarget = index;
  renderSelection();
}

function renderSelection() {
  sourceButtons.forEach((button) => {
    const active = Number(button.dataset.source) === selectedSource;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  targetButtons.forEach((button) => {
    const index = Number(button.dataset.target);
    const disabled = index === selectedSource;
    const active = index === selectedTarget && !disabled;
    button.disabled = disabled;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  processNodes.forEach((node) => {
    const index = Number(node.dataset.process);
    node.classList.toggle("is-source", index === selectedSource);
    node.classList.toggle("is-target", index === selectedTarget);
  });

  networkLinks.forEach((line) => line.classList.remove("is-active"));
  sendMessageButton.textContent = `Send ${processName(selectedSource)} → ${processName(selectedTarget)}`;
}

function renderClocks(changedProcess = null, changedComponents = []) {
  clocks.forEach((clock, processIndex) => {
    clock.forEach((value, componentIndex) => {
      const cell = document.querySelector(`[data-clock="${processIndex}-${componentIndex}"]`);
      cell.textContent = value;
      const changed = processIndex === changedProcess && changedComponents.includes(componentIndex);
      cell.classList.toggle("is-changed", changed);
    });
  });

  if (changedProcess !== null) {
    const node = processNodes[changedProcess];
    node.classList.add("is-updating");
    window.setTimeout(() => {
      node.classList.remove("is-updating");
      changedComponents.forEach((componentIndex) => {
        document
          .querySelector(`[data-clock="${changedProcess}-${componentIndex}"]`)
          .classList.remove("is-changed");
      });
    }, 520);
  }
}

function recordEvent(type, processIndex, clock, detail) {
  events.push({
    id: events.length + 1,
    type,
    processIndex,
    clock: [...clock],
    detail,
  });
  renderEventLog();
  renderComparison();
  eventCounter.textContent = `${events.length} ${events.length === 1 ? "event" : "events"}`;
}

function renderEventLog() {
  if (events.length === 0) {
    eventLog.innerHTML = `
      <div class="empty-state" id="empty-log">
        <span class="empty-icon" aria-hidden="true">⌁</span>
        <strong>No events yet</strong>
        <p>Add a local event or send a message to begin.</p>
      </div>
    `;
    return;
  }

  eventLog.innerHTML = [...events]
    .reverse()
    .map((event) => `
      <article class="event-item is-${event.type}">
        <span class="event-index">E${event.id}</span>
        <div class="event-description">
          <strong>${event.detail}</strong>
          <span>${processName(event.processIndex)} · ${event.type} event</span>
        </div>
        <code class="event-clock">${formatClock(event.clock)}</code>
      </article>
    `)
    .join("");
}

function compareClocks(first, second) {
  let firstHasSmaller = false;
  let secondHasSmaller = false;

  for (let index = 0; index < PROCESS_COUNT; index += 1) {
    if (first[index] < second[index]) firstHasSmaller = true;
    if (first[index] > second[index]) secondHasSmaller = true;
  }

  if (firstHasSmaller && !secondHasSmaller) return "before";
  if (secondHasSmaller && !firstHasSmaller) return "after";
  if (!firstHasSmaller && !secondHasSmaller) return "equal";
  return "concurrent";
}

function renderComparison() {
  comparisonResult.className = "comparison-result is-waiting";

  if (events.length < 2) {
    comparisonA.textContent = events[0] ? formatClock(events[0].clock) : "[—, —, —]";
    comparisonB.textContent = "[—, —, —]";
    comparisonMark.textContent = "?";
    comparisonResult.innerHTML = `
      <span class="result-icon" aria-hidden="true"></span>
      <div>
        <strong>Add two events to compare them</strong>
        <p>Vector clocks reveal causal order without requiring synchronized physical clocks.</p>
      </div>
    `;
    return;
  }

  const first = events.at(-2);
  const second = events.at(-1);
  const relationship = compareClocks(first.clock, second.clock);

  comparisonA.textContent = formatClock(first.clock);
  comparisonB.textContent = formatClock(second.clock);

  const messages = {
    before: {
      mark: "<",
      className: "is-causal",
      title: `E${first.id} happened before E${second.id}`,
      detail: "Every component in A is less than or equal to B, with at least one strictly smaller.",
    },
    after: {
      mark: ">",
      className: "is-causal",
      title: `E${second.id} happened before E${first.id}`,
      detail: "Every component in B is less than or equal to A, with at least one strictly smaller.",
    },
    equal: {
      mark: "=",
      className: "is-causal",
      title: "The timestamps are equal",
      detail: "Equal vectors represent the same accumulated causal knowledge.",
    },
    concurrent: {
      mark: "∥",
      className: "is-concurrent",
      title: `E${first.id} and E${second.id} are concurrent`,
      detail: "Each vector has a component greater than the other, so neither event causally precedes the other.",
    },
  };

  const message = messages[relationship];
  comparisonMark.textContent = message.mark;
  comparisonResult.className = `comparison-result ${message.className}`;
  comparisonResult.innerHTML = `
    <span class="result-icon" aria-hidden="true"></span>
    <div>
      <strong>${message.title}</strong>
      <p>${message.detail}</p>
    </div>
  `;
}

function createLocalEvent(processIndex = selectedSource) {
  if (busy) return;

  clocks[processIndex][processIndex] += 1;
  renderClocks(processIndex, [processIndex]);
  recordEvent("local", processIndex, clocks[processIndex], `${processName(processIndex)} performs local work`);
  setStatus(`${processName(processIndex)} advanced its own logical time`);
}

function activeLink(source, target) {
  const linkKey = [source, target].sort((a, b) => a - b).join("-");
  return networkLinks.find((line) => line.dataset.link === linkKey);
}

function packetCoordinates(node) {
  const stageRect = networkStage.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  return {
    x: nodeRect.left - stageRect.left + nodeRect.width / 2,
    y: nodeRect.top - stageRect.top + nodeRect.height / 2,
  };
}

async function animateMessage(source, target, timestamp) {
  const sourcePoint = packetCoordinates(processNodes[source]);
  const targetPoint = packetCoordinates(processNodes[target]);
  const line = activeLink(source, target);

  packetClock.textContent = formatClock(timestamp);
  messagePacket.style.left = `${sourcePoint.x}px`;
  messagePacket.style.top = `${sourcePoint.y}px`;
  messagePacket.classList.add("is-visible");
  line?.classList.add("is-active");

  const animation = messagePacket.animate(
    [
      { left: `${sourcePoint.x}px`, top: `${sourcePoint.y}px`, opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.88 },
      { left: `${targetPoint.x}px`, top: `${targetPoint.y}px`, opacity: 0, offset: 1 },
    ],
    {
      duration: ANIMATION_MS,
      easing: "cubic-bezier(.4, 0, .2, 1)",
      fill: "forwards",
    },
  );

  await animation.finished;
  animation.cancel();
  messagePacket.classList.remove("is-visible");
  line?.classList.remove("is-active");
}

async function sendMessage(source = selectedSource, target = selectedTarget) {
  if (busy || source === target) return;

  setBusy(true);
  clocks[source][source] += 1;
  const timestamp = [...clocks[source]];
  renderClocks(source, [source]);
  recordEvent("send", source, timestamp, `${processName(source)} sends to ${processName(target)}`);
  setStatus(`${processName(source)} sent ${formatClock(timestamp)} to ${processName(target)}`);

  await animateMessage(source, target, timestamp);

  const previousClock = [...clocks[target]];
  clocks[target] = clocks[target].map((value, index) => Math.max(value, timestamp[index]));
  clocks[target][target] += 1;
  const changedComponents = clocks[target]
    .map((value, index) => (value !== previousClock[index] ? index : -1))
    .filter((index) => index !== -1);

  renderClocks(target, changedComponents);
  recordEvent("receive", target, clocks[target], `${processName(target)} receives from ${processName(source)}`);
  setStatus(`${processName(target)} merged the timestamp and advanced its own component`);
  setBusy(false);
}

function reset() {
  demoRun += 1;
  clocks = createEmptyClocks();
  events = [];
  selectedSource = 0;
  selectedTarget = 1;
  messagePacket.classList.remove("is-visible");
  networkLinks.forEach((line) => line.classList.remove("is-active"));
  renderSelection();
  renderClocks();
  renderEventLog();
  renderComparison();
  eventCounter.textContent = "0 events";
  setStatus("Ready for an event");
  setBusy(false);
}

async function runCausalDemo() {
  if (busy) return;
  reset();
  const run = demoRun;
  setBusy(true);
  setStatus("Causal example: P1 begins independently");
  await wait(350);
  if (run !== demoRun) return;

  setBusy(false);
  createLocalEvent(0);
  await wait(500);
  if (run !== demoRun) return;

  await sendMessage(0, 1);
  if (run !== demoRun) return;
  await wait(350);

  await sendMessage(1, 2);
  if (run !== demoRun) return;

  selectedSource = 1;
  selectedTarget = 2;
  renderSelection();
  setStatus("Causal chain complete: P1 → P2 → P3");
}

async function runConcurrentDemo() {
  if (busy) return;
  reset();
  const run = demoRun;
  setBusy(true);
  setStatus("Concurrent example: no messages connect the events");
  await wait(350);
  if (run !== demoRun) return;

  setBusy(false);
  createLocalEvent(0);
  await wait(450);
  if (run !== demoRun) return;

  createLocalEvent(1);
  selectedSource = 1;
  selectedTarget = 0;
  renderSelection();
  setStatus("P1 and P2 acted independently, so the events are concurrent");
}

sourceButtons.forEach((button) => {
  button.addEventListener("click", () => setSource(Number(button.dataset.source)));
});

targetButtons.forEach((button) => {
  button.addEventListener("click", () => setTarget(Number(button.dataset.target)));
});

localEventButton.addEventListener("click", () => createLocalEvent());
sendMessageButton.addEventListener("click", () => sendMessage());
resetButton.addEventListener("click", reset);
causalDemoButton.addEventListener("click", runCausalDemo);
concurrentDemoButton.addEventListener("click", runConcurrentDemo);

renderSelection();
renderClocks();
renderComparison();

# Vector Clocks — Interactive Visualizer

A distributed systems simulator that visualizes **vector clocks** through a live space-time diagram. Watch causal relationships form in real time as you route messages between three processes.

## Features

- **Live space-time diagram** — events plotted as dots on process timelines, messages as arrows
- **Animated vector clock cards** — each component highlights when it changes
- **Event log** — colour-coded per event type (send / receive / internal)
- **WebSocket-driven** — no page refreshes; state updates instantly via Socket.IO

## Quick Start

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://localhost:5000** in your browser.

## How It Works

Each process maintains a vector `[c1, c2, c3]`:

| Event | Rule |
|-------|------|
| **Send** | Increment own counter, attach clock to message |
| **Receive** | Component-wise max with received clock, then increment own |
| **Internal** | Increment own counter only |

## Original CLI Version

The original socket-based multi-process implementation is preserved in `Clock.py`, `System1.py`, `System2.py`, and `System3.py`. Run each system in a separate terminal, then run `Clock.py` to coordinate messages.

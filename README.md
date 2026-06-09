# Vector Clock Visualizer

This repository contains a three-process Python vector-clock demo and a static
GitHub Pages visualization for exploring causal ordering in distributed systems.

Live page: https://usamahmoin.github.io/Vector-Clocks/

## What the visualization shows

- Three distributed processes arranged as their own entities in a triangle.
- Local events that increment only the active process component.
- Message sends that carry the sender's full vector timestamp.
- Receive events that merge with a component-wise maximum, then increment the receiver.
- A causality inspector that compares the two latest events as causal, equal, or concurrent.
- Guided examples for a causal chain and for independent concurrent events.

## Research basis

The interactive page follows the standard happened-before and vector timestamp
model from distributed systems literature:

- Leslie Lamport, "Time, Clocks, and the Ordering of Events in a Distributed System" (1978).
- Colin Fidge, "Timestamps in Message-Passing Systems That Preserve the Partial Ordering" (1988).
- Friedemann Mattern, "Virtual Time and Global States of Distributed Systems" (1989).

## Project files

- `index.html` - GitHub Pages entry point.
- `style.css` - shared visual theme and responsive layout.
- `script.js` - interactive vector-clock simulation.
- `System1.py`, `System2.py`, `System3.py` - socket listeners for the Python demo.
- `Clock.py` - message-send helper used by the Python demo.

## Run the web page locally

```bash
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

## Run the Python socket demo

Start each system in a separate terminal:

```bash
python3 System1.py
python3 System2.py
python3 System3.py
```

Then run `Clock.py` from another terminal to send timestamped messages between
the processes.

## GitHub Pages

This repository is designed to be published from the `main` branch at the
repository root.

# Vector Clocks Project

This project implements a distributed system simulation using vector clocks to maintain the partial ordering of events in a distributed system.

## Project Structure

The project consists of the following files:
- `System1.py`
- `System2.py`
- `System3.py`
- `Clock.py`

### System1.py

This file contains the implementation for the first system node in the distributed system. It initializes the vector clock for the node, handles communication with other nodes, and processes incoming messages. The node can send and receive messages, updating its vector clock accordingly to maintain the correct order of events.

### System2.py

This file contains the implementation for the second system node in the distributed system. Similar to `System1.py`, it initializes the vector clock, handles communication, and processes messages. The node interacts with other nodes, updating its vector clock to reflect the partial ordering of events in the system.

### System3.py

This file contains the implementation for the third system node in the distributed system. It follows the same structure as `System1.py` and `System2.py`, initializing the vector clock, handling communication, and processing messages. The node ensures that its vector clock accurately reflects the ordering of events in the distributed system.

### Clock.py

This file contains the implementation of the vector clock mechanism used by the system nodes. It provides the necessary functions for initializing, updating, and comparing vector clocks. The vector clock helps maintain the partial ordering of events in the distributed system by capturing the causal relationships between events.

## How to Run

1. Ensure you have Python installed on your system.
2. Run each system node in separate terminal windows or tabs.
   ```bash
   python System1.py
   python System2.py
   python System3.py

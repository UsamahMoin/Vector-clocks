from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'vectorclocks'
socketio = SocketIO(app, cors_allowed_origins="*")

vc = [[0,0,0], [0,0,0], [0,0,0]]
events = []
event_id = 0

def get_state():
    return [row[:] for row in vc]

def send_event(proc, clock, kind, linked_to=None):
    global event_id
    ev = {
        'id': event_id,
        'proc': proc,
        'clock': clock[:],
        'kind': kind,
        'linked_to': linked_to,
    }
    events.append(ev)
    event_id += 1
    return ev

def simulate(sender, receiver):
    """Pure vector-clock simulation; returns list of new events."""
    s = sender - 1
    r = receiver - 1
    new_evs = []

    if sender == receiver:
        before = vc[s][:]
        vc[s][s] += 1
        ev = send_event(s, vc[s], 'internal')
        new_evs.append(ev)
    else:
        # Send side
        vc[s][s] += 1
        send_ev = send_event(s, vc[s], 'send')
        new_evs.append(send_ev)

        # Receive side: merge then increment
        for i in range(3):
            vc[r][i] = max(vc[r][i], vc[s][i])
        vc[r][r] += 1
        recv_ev = send_event(r, vc[r], 'recv', linked_to=send_ev['id'])
        new_evs.append(recv_ev)

    return new_evs

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def state():
    return jsonify({'events': events, 'clocks': vc})

@app.route('/api/reset', methods=['POST'])
def reset():
    global vc, events, event_id
    vc = [[0,0,0], [0,0,0], [0,0,0]]
    events = []
    event_id = 0
    socketio.emit('reset')
    return jsonify({'ok': True})

@socketio.on('send_message')
def handle_message(data):
    sender = int(data['sender'])
    receiver = int(data['receiver'])
    if sender < 1 or sender > 3 or receiver < 1 or receiver > 3:
        emit('error', {'msg': 'Process IDs must be 1–3'})
        return
    new_evs = simulate(sender, receiver)
    emit('new_events', {'events': new_evs, 'clocks': vc}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)

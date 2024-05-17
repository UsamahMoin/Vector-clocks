import socket
from _thread import *

systemSocket = socket.socket()
host = '127.0.0.1'
port = 1234
thread_num = 0
try:
    systemSocket.bind((host, port))
except socket.error as e:
    print("ERROR: ",str(e))

print('-- SYSTEM 3 IS WAITING FOR A CONNECTION --')
systemSocket.listen(5)

def threaded_process(conn):
    while True:
        recv_val = conn.recv(2048)
        temp = recv_val.decode('utf-8')
        print("Value of Vector ([BEFORE],[AFTER]): ",temp)
        if not recv_val:
            break
        conn.sendall(str.encode('ACKNOWLEDGEMENT FROM SYSTEM 3'))
    conn.close()

while True:
    Client, addr = systemSocket.accept()
    print('CONNECTED: ' + addr[0] + '/' + str(addr[1]))
    start_new_thread(threaded_process, (Client, ))
    thread_num += 1
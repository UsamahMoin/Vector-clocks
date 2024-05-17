import socket

socket_one = socket.socket()
socket_two = socket.socket()
socket_three = socket.socket()
host_one = '127.0.0.1'
port_one = 1235
host_two = '127.0.0.1'
port_two = 1233 
host_three = '127.0.0.1'
port_three = 1234


try:
    socket_one.connect((host_one, port_one))
    socket_two.connect((host_two, port_two))
    socket_three.connect((host_three, port_three))
except socket.error as e:
    print(str(e))

vc1 = [0,0,0]
vc2 = [0,0,0]
vc3 = [0,0,0]
p = [0,0,0]

def sender_func(var):
    if(var == 1):
        beforesent = vc1.copy()
        vc1[0] += 1
        p[0] = vc1[0]
        aftersent = vc1.copy()
        return beforesent,aftersent
    elif(var == 2):
        beforesent = vc2.copy()
        vc2[1] += 1
        p[1] = vc2[1]
        aftersent = vc2.copy()
        return beforesent,aftersent
    elif(var == 3):
        beforesent = vc3.copy()
        vc3[2] += 1
        p[2] = vc3[2]
        aftersent = vc3.copy()
        return beforesent,aftersent
    else:
        print("Enter Values between 1 and 3")

def recv_func(var,sender):
    match var:
        case 1:
            beforerecv = vc1.copy()
            vc1[sender-1] = p[sender-1]
            vc1[0] += 1
            if(sender == 2):
                vc1[2] = vc2[2]
            else:
                vc1[1] = vc3[1]
            p[0] = vc1[0]
            afterrecv = vc1.copy()
            return beforerecv,afterrecv
        case 2:
            beforerecv = vc2.copy()
            vc2[sender-1] = p[sender-1]
            vc2[1] += 1
            if(sender == 1):
                vc2[2] = vc2[2]
            else:
                vc2[0] = vc3[0]
            p[1] = vc2[1]
            afterrecv = vc2.copy()
            return beforerecv,afterrecv
        case 3:
            beforerecv = vc3.copy()
            vc3[sender-1] = p[sender-1]
            vc3[2] += 1
            if(sender == 2):
                vc3[0] = vc2[0]
            else:
                vc3[1] = vc1[1]
            p[2] = vc3[2]
            afterrecv = vc3.copy()
            return beforerecv,afterrecv
        case _:
            print("Enter Values between 1 and 3")

def sendmessage(pid,message):
    match pid:
        case 1:
            socket_one.send(str.encode(message))
            resp_1 = socket_one.recv(1024)
            print(resp_1.decode('utf-8'))
        case 2:
            socket_two.send(str.encode(message))
            resp_2 = socket_two.recv(1024)
            print(resp_2.decode('utf-8'))
        case 3:
            socket_three.send(str.encode(message))
            resp_3 = socket_three.recv(1024)
            print(resp_3.decode('utf-8'))
def main():    
    while True:
        sender = int(input("Enter the process sending the message:"))
        receiver = int(input("Enter the process receiving the message:"))

        if (sender == receiver):
            beforesent,aftersent = sender_func(sender)
            sent_temp=(beforesent,aftersent)
            sent_package=str(sent_temp)
            sendmessage(sender,sent_package)

        else:
            beforesent,aftersent = sender_func(sender)
            beforerecv,afterrecv = recv_func(receiver,sender)
            sent_temp=(beforesent,aftersent)
            recv_temp=(beforerecv,afterrecv)
            sent_package=str(sent_temp)
            recv_package=str(recv_temp)
            sendmessage(sender,sent_package)
            sendmessage(receiver,recv_package)

if __name__=="__main__":
    main()
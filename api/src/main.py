import queue
import threading
import json
import uuid
import socket

import flask
from flask_cors import CORS

from api.src.wsmanager import WebsocketManager, main


def validate_token(token):

    return True


def create_or_update_token(new_token):

    if new_token and new_token.get('id', None):
        if validate_token(new_token):
            tokens[new_token['id']] = new_token
            print(new_token)
            return #flask.Response(status=201)
    return #flask.Response(status=400)


def get_state():

    return json.dumps(list(tokens.values()))


def q_listener(sq, rq):

    while True:
        try:
            create_or_update_token(json.loads(rq.get()))
            sq.put(get_state())
        except Exception as e:
            print(e)


if __name__ == '__main__':

    app = flask.Flask(__name__)
    CORS(app)
    host = socket.gethostbyname(socket.gethostname())
    websocket_port = 8765
    tokens = {}
    send_q = queue.Queue()
    receive_q = queue.Queue()

    ws = threading.Thread(target=main, args=(send_q, receive_q, host_ip, websocket_port))
    ws.daemon = True
    ws.start()
    ql = threading.Thread(target=q_listener, args=(send_q, receive_q))
    ql.daemon = True
    ql.start()

    @app.route('/api/socket', methods=['GET'])
    def create_websocket_session():

        new_id = uuid.uuid4()
        return flask.make_response({'path': f'{host}:{websocket_port}/{new_id}'})

    app.run(host='0.0.0.0')

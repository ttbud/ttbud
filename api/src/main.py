import queue
import threading
import uuid
import socket

import flask
from flask_cors import CORS

try:
    # Most common case - running this from a terminal
    from wsmanager import start_websocket
except ImportError:
    try:
        # Running from an IDE will use this
        from api.src.wsmanager import start_websocket
    except ImportError:
        # Weird edge case - if this fails, we crash, because something is wrong, and we don't know what
        from src.wsmanager import start_websocket


if __name__ == '__main__':

    app = flask.Flask(__name__)
    CORS(app)
    #host = socket.gethostbyname(socket.gethostname())
    host = '0.0.0.0'
    websocket_port = 8765
    tokens = {}
    uuid_q = queue.Queue()

    ws = threading.Thread(target=start_websocket, args=(uuid_q, host, websocket_port))
    ws.daemon = True
    ws.start()

    @app.route('/api/socket', methods=['GET'])
    def create_websocket_session():

        new_id = uuid.uuid4()
        print(f'New UUID: {new_id}')
        uuid_q.put(new_id)
        return flask.make_response({'path': f'ws://ttbud.sjoh.net:{websocket_port}/{new_id}'})

    app.run(host='0.0.0.0', port=5000)

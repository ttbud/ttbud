import asyncio
import queue
import json

import websockets


class RoomData:

    def __init__(self, unique_id):

        self.unique_id = unique_id
        self.clients = []
        self.state = {}


class WebsocketManager:

    def __init__(self, send_q, receive_q, host, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._connections = set()
        self._q = queue.Queue()
        self.host = host
        self.port = port
        self.rooms = {}
        self.tokens = {}
        self.send_q = send_q
        self.receive_q = receive_q

    def start_server(self):

        try:
            ws_server = websockets.serve(
                self.consumer_handler,
                self.host,
                self.port,
            )

            asyncio.ensure_future(self.producer_handler())
            self._loop.run_until_complete(ws_server)
        except OSError as e:
            print(e)
        else:
            self._loop.run_forever()

    async def consumer_handler(self, websocket, path):

        self._connections.add(websocket)
        print(path)
        self.send_q.put(self.get_state())
        try:
            async for message in websocket:
                await self.consume(message)
        finally:
            self._connections.remove(websocket)

    async def producer_handler(self):

        while True:
            try:
                message = self.send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None and self._connections:
                print(message)
                await asyncio.wait([client.send(message) for client in self._connections])

    async def consume(self, json_message):

        try:
            message = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        action = message.get('action', None)
        data = message.get('data', None)
        if action == 'delete':
            if self.tokens.get(data['id'], None):
                del self.tokens[data['id']]
        elif self.validate_token(data) and action == 'create' or action == 'update':
            self.create_or_update_token(data)
        else:
            print(f'Received an invalid action or token: {action}: {data}')
        self.send_q.put(self.get_state())

    @staticmethod
    def validate_token(token):

        return token.get('id', False) and \
               token.get('x', False) and \
               token.get('y', False) and \
               token.get('icon', False)

    def create_or_update_token(self, new_token):

        if new_token and new_token.get('id', None):
            self.tokens[new_token['id']] = new_token
            print(new_token)

    def get_state(self):

        return json.dumps(list(self.tokens.values()))


def start_websocket(send_q, receive_q, host_ip, host_port):

    ws = WebsocketManager(send_q, receive_q, host_ip, host_port)
    ws.start_server()

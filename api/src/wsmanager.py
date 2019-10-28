import asyncio
import queue
import json

import websockets


class WebsocketManager:

    def __init__(self, uuid_q, host, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._connections = {}
        self._send_q = queue.Queue()
        self.host = host
        self.port = port
        self.rooms = {}
        self.uuid_q = uuid_q
        self._valid_paths = set()

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

        p = path.lstrip('/')
        print(p)
        while True:
            try:
                self._valid_paths.add(str(self.uuid_q.get_nowait()))
            except queue.Empty:
                break
        if p in self._valid_paths:
            if self._connections.get(p, None):
                self._connections[p].add(websocket)
            else:
                self._connections[p] = set()
                self._connections[p].add(websocket)
            if self.rooms.get(p, None):
                self._send_q.put((self.get_state(p), p))
            else:
                self.rooms[p] = {}
            try:
                async for message in websocket:
                    await self.consume(message, p)
            finally:
                self._connections[p].remove(websocket)

    async def producer_handler(self):

        while True:
            try:
                message, path = self._send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None and self._connections[path]:
                print(message)
                await asyncio.wait([client.send(message) for client in self._connections[path]])

    async def consume(self, json_message, path):

        try:
            message = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        action = message.get('action', None)
        data = message.get('data', None)
        if action == 'delete':
            if self.rooms[path].get(data['id'], None):
                del self.rooms[path][data['id']]
        elif self.validate_token(data) and \
                self.validate_position(data, path) and \
                (action == 'create' or action == 'update'):
            self.create_or_update_token(data, path)
        else:
            print(f'Received an invalid action or token: {action}: {data}')
        self._send_q.put((self.get_state(path), path))

    def validate_token(self, token):

        return 'id' in token.keys() and \
               'x' in token.keys() and \
               'y' in token.keys() and \
               'icon' in token.keys()

    def validate_position(self, new_token, path):

        for token in self.rooms[path].values():
            if token['x'] == new_token['x'] and token['y'] == new_token['y']:
                return False
        return True

    def create_or_update_token(self, new_token, path):

        if new_token and new_token.get('id', None):
            self.rooms[path][new_token['id']] = new_token
            print(new_token)

    def get_state(self, path):

        return json.dumps(list(self.rooms[path].values()))


def start_websocket(uuid_q, host_ip, host_port):

    ws = WebsocketManager(uuid_q, host_ip, host_port)
    ws.start_server()

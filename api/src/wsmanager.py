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
        self._valid_room_ids = set()

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

    async def consumer_handler(self, websocket, room_id):

        room_id = room_id.lstrip('/')
        print(room_id)
        while True:
            try:
                self._valid_room_ids.add(str(self.uuid_q.get_nowait()))
            except queue.Empty:
                break
        if room_id in self._valid_room_ids:
            if self._connections.get(room_id, None):
                self._connections[room_id].add(websocket)
            else:
                self._connections[room_id] = set()
                self._connections[room_id].add(websocket)
            if self.rooms.get(room_id, None):
                self._send_q.put((self.get_state(room_id), room_id))
            else:
                self.rooms[room_id] = {}
            try:
                async for message in websocket:
                    await self.consume(message, room_id)
            finally:
                self._connections[room_id].remove(websocket)

    async def producer_handler(self):

        while True:
            try:
                message, room_id = self._send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None and self._connections[room_id]:
                print(message)
                await asyncio.wait([client.send(message) for client in self._connections[room_id]])

    async def consume(self, json_message, room_id):

        try:
            messages = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        for message in messages:
            action = message.get('action', None)
            data = message.get('data', None)
            if action == 'delete':
                if self.rooms[room_id].get(data['id'], None):
                    del self.rooms[room_id][data['id']]
            elif self.validate_token(data) and \
                    self.validate_position(data, room_id) and \
                    (action == 'create' or action == 'update'):
                self.create_or_update_token(data, room_id)
            else:
                print(f'Received an invalid action or token: {action}: {data}')
        self._send_q.put((self.get_state(room_id), room_id))

    def validate_token(self, token):

        return 'id' in token.keys() and \
               'start_x' in token.keys() and \
               'end_x' in token.keys() and \
               'start_y' in token.keys() and \
               'end_y' in token.keys() and \
               'start_z' in token.keys() and \
               'end_z' in token.keys() and \
               'icon' in token.keys()

    def validate_position(self, new_token, room_id):

        for token in self.rooms[room_id].values():
            if self.check_collision(token, new_token) or self.check_collision(new_token, token):
                return False
        return True

    def check_collision(self, token1, token2):

        if self.corner_intersects_token(token1,
                                        token2['start_x'],
                                        token2['start_y'],
                                        token2['start_z'],
                                        ) or \
                self.corner_intersects_token(token1,
                                             token2['start_x'],
                                             token2['end_y'],
                                             token2['start_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['end_x'],
                                             token2['start_y'],
                                             token2['start_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['end_x'],
                                             token2['end_y'],
                                             token2['start_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['start_x'],
                                             token2['start_y'],
                                             token2['end_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['start_x'],
                                             token2['end_y'],
                                             token2['end_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['end_x'],
                                             token2['start_y'],
                                             token2['end_z'],
                                             ) or \
                self.corner_intersects_token(token1,
                                             token2['end_x'],
                                             token2['end_y'],
                                             token2['end_z'],
                                             ):
            return False
        return True

    def corner_intersects_token(self, token, x, y, z):

        if token['end_x'] >= x >= token['start_x'] and \
                token['end_y'] >= y >= token['start_y'] and \
                token['end_z'] >= z >= token['start_z']:
            return False
        return True

    def create_or_update_token(self, new_token, room_id):

        if new_token and new_token.get('id', None):
            self.rooms[room_id][new_token['id']] = new_token
            print(new_token)

    def get_state(self, room_id):

        return json.dumps(list(self.rooms[room_id].values()))


def start_websocket(uuid_q, host_ip, host_port):

    ws = WebsocketManager(uuid_q, host_ip, host_port)
    ws.start_server()

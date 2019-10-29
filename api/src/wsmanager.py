import asyncio
import queue
import json

import websockets


UNIT_SIZE = 50


class RoomData:

    def __init__(self, room_id, initial_connection=None):

        self.room_id = room_id
        self.game_state = {}
        self.id_to_positions = {}
        self.positions_to_ids = {}
        self.clients = set()
        if initial_connection:
            self.clients.add(initial_connection)


class WebsocketManager:

    def __init__(self, uuid_q, host, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.rooms = {}
        self.uuid_q = uuid_q
        self._send_q = queue.Queue()
        self.host = host
        self.port = port
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
            if self.rooms.get(room_id, False):
                self.rooms[room_id].clients.add(websocket)
                self._send_q.put((self.get_state(room_id), room_id))
            else:
                self.rooms[room_id] = RoomData(room_id, initial_connection=websocket)

            try:
                async for message in websocket:
                    await self.consume(message, room_id)
            finally:
                self.rooms[room_id].clients.remove(websocket)

    async def producer_handler(self):

        while True:
            try:
                message, room_id = self._send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None and self.rooms[room_id].clients:
                print(message)
                await asyncio.wait([client.send(message) for client in self.rooms[room_id].clients])

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
                if self.rooms[room_id].game_state.get(data['id'], None):
                    del self.rooms[room_id].game_state[data['id']]
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
               'icon' in token.keys() and \
               token['start_x'] < token['end_x'] and \
               token['start_y'] < token['end_y'] and \
               token['start_z'] < token['end_z']

    def validate_position(self, new_token, room_id):

        blocks = self.get_unit_blocks(new_token)
        for block in blocks:
            if self.rooms[room_id].positions_to_ids.get(block, False):
                return False
        return True

    def create_or_update_token(self, new_token, room_id):

        print(new_token)
        if self.rooms[room_id].get(new_token['id']):
            # Remove previous position data for existing token
            positions = self.rooms[room_id].id_to_positions[new_token['id']].pop()
            for pos in positions:
                del self.rooms[room_id].positions_to_ids[pos]

        # Update state for new or existing token
        blocks = self.get_unit_blocks(new_token)
        self.rooms[room_id].id_to_positions[new_token['id']] = blocks
        for block in blocks:
            self.rooms[room_id].positions_to_ids[block] = new_token['id']
        self.rooms[room_id].game_state[new_token['id']] = new_token

    @staticmethod
    def get_unit_blocks(token):

        unit_blocks = []
        for x in range(token['start_x'], token['end_x'], UNIT_SIZE):
            for y in range(token['start_y'], token['end_y'], UNIT_SIZE):
                for z in range(token['start_z'], token['end_z'], UNIT_SIZE):
                    unit_blocks.append((x, y, z))
        return unit_blocks

    def get_state(self, room_id):

        return json.dumps(list(self.rooms[room_id].game_state.values()))


def start_websocket(uuid_q, host_ip, host_port):

    ws = WebsocketManager(uuid_q, host_ip, host_port)
    ws.start_server()

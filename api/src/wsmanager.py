import asyncio
import queue
import json

import websockets

from game_state_server import GameStateServer


class WebsocketManager:

    def __init__(self, uuid_q, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.uuid_q = uuid_q
        self._send_q = queue.Queue()
        self.port = port
        self._valid_room_ids = set()
        self.gss = GameStateServer()

    def start_server(self):

        try:
            ws_server = websockets.serve(
                self.consumer_handler,
                '0.0.0.0',
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
            response = self.gss.new_connection_request(websocket, room_id)
            self._send_q.put((response, room_id))
            try:
                async for message in websocket:
                    await self.consume(message, room_id)
            finally:
                self.gss.connection_dropped(websocket, room_id)

    async def producer_handler(self):

        while True:
            try:
                message, room_id = self._send_q.get_nowait()
            except queue.Empty:
                await asyncio.sleep(0.0001)          # Induced delay to free up event loop
                continue
            if message is not None:
                print(message)
                await asyncio.wait([client.send(json.dumps(message)) for client in self.gss.get_clients(room_id)])

    async def consume(self, json_message, room_id):

        try:
            messages = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        response = self.gss.process_updates(messages, room_id)
        self._send_q.put((response, room_id))


def start_websocket(uuid_q, host_port):
    ws = WebsocketManager(uuid_q, host_port)
    ws.start_server()

import asyncio
import queue
import json

import websockets

from game_state_server import GameStateServer, MessageError


class WebsocketManager:

    def __init__(self, uuid_q, port):

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.uuid_q = uuid_q
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

            self._loop.run_until_complete(ws_server)
        except OSError as e:
            print(e)
        else:
            self._loop.run_forever()

    async def consumer_handler(self, client, room_id):
        room_id = room_id.lstrip('/')
        print(room_id)
        while True:
            try:
                self._valid_room_ids.add(str(self.uuid_q.get_nowait()))
            except queue.Empty:
                break
        if room_id in self._valid_room_ids:
            response = self.gss.new_connection_request(client, room_id)
            await self.send_message_to_client(response, client)
            try:
                async for message in client:
                    await self.consume(message, room_id, client)
            finally:
                self.gss.connection_dropped(client, room_id)

    async def send_message_to_client(self, message, client):

        if message and client:
            await client.send(json.dumps(message))

    async def send_message_to_room(self, message, room_id):

        if message:
            await asyncio.wait([client.send(json.dumps(message)) for client in self.gss.get_clients(room_id)])

    async def consume(self, json_message, room_id, client):

        try:
            messages = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        response = None
        for message in messages:
            try:
                response = self.gss.process_updates(message, room_id)
            except MessageError as err:
                print(err)
                await self.send_message_to_client({'Error': err.message}, client)
        if response:
            await self.send_message_to_room(response, room_id)


def start_websocket(uuid_q, host_port):
    ws = WebsocketManager(uuid_q, host_port)
    ws.start_server()

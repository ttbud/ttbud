import asyncio
import queue
import json
from typing import Union

import websockets

from game_state_server import GameStateServer, MessageError


class WebsocketManager:
    def __init__(self, uuid_q, port):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.uuid_q = uuid_q
        self.port = port
        self.gss = GameStateServer()
        self._valid_room_ids = set(self.gss.valid_previous_rooms())

    def start_server(self) -> None:
        try:
            ws_server = websockets.serve(self.consumer_handler, '0.0.0.0', self.port)

            self._loop.run_until_complete(ws_server)
        except OSError as e:
            print(e)
        else:
            self._loop.run_forever()

    async def consumer_handler(
        self, client: websockets.WebSocketServerProtocol, room_id: str
    ) -> None:
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

    @staticmethod
    async def send_message_to_client(
        message: dict, client: websockets.WebSocketServerProtocol
    ) -> None:
        if message and client:
            await client.send(json.dumps(message))

    async def send_message_to_room(self, message: dict, room_id: str) -> None:
        if message:
            await asyncio.wait(
                [
                    client.send(json.dumps(message))
                    for client in self.gss.get_clients(room_id)
                ]
            )

    async def consume(
        self,
        json_message: Union[str, bytes],
        room_id: str,
        client: websockets.WebSocketServerProtocol,
    ) -> None:
        try:
            messages = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return

        response = {
            "type": "state",
            "data": self.gss.get_state(room_id),
        }

        for message in messages:
            try:
                response = self.gss.process_update(message, room_id)
            except MessageError as err:
                print(err)
                await self.send_message_to_client({'Error': err.message}, client)
        await self.send_message_to_room(response, room_id)


def start_websocket(uuid_q, host_port):
    ws = WebsocketManager(uuid_q, host_port)
    ws.start_server()

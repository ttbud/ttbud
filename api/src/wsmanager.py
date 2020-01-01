import asyncio
import json
from dataclasses import asdict
from typing import Union
from uuid import UUID

import websockets

from game_state_server import GameStateServer, MessageError


def is_valid_uuid(uuid_string):
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    print(f'{val.hex} : {uuid_string}')
    return val.hex == uuid_string.replace('-', '')


class WebsocketManager:
    def __init__(self, port, room_store_dir):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.port = port
        self.gss = GameStateServer(room_store_dir)
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
        if is_valid_uuid(room_id):
            response = self.gss.new_connection_request(client, room_id)
            await self.send_message_to_client(response, client)
            try:
                async for message in client:
                    await self.consume(message, room_id, client)
            finally:
                self.gss.connection_dropped(client, room_id)
        else:
            print(f'Invalid uuid: {room_id}')

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
                response = asdict(self.gss.process_update(message, room_id))
            except MessageError as err:
                print(err)
                await self.send_message_to_client({'Error': err.message}, client)
        await self.send_message_to_room(response, room_id)


def start_websocket(host_port, room_store_dir):
    ws = WebsocketManager(host_port, room_store_dir)
    ws.start_server()

import asyncio
import json
from dataclasses import asdict
from typing import Union
from uuid import UUID
from http import HTTPStatus

import websockets
from websockets.http import Headers

from game_state_server import MessageError


def is_valid_uuid(uuid_string):
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


class WebsocketManager:
    def __init__(self, port, gss):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self.port = port
        self.gss = gss
        self.gss.set_websocket_callback = self.send_message_to_room

    @staticmethod
    async def process_request(path, request_headers):
        if is_valid_uuid(path.lstrip('/')):
            return None
        else:
            return HTTPStatus.BAD_REQUEST, Headers(), b''

    def start_server(self) -> None:
        try:
            ws_server = websockets.serve(
                self.consumer_handler,
                '0.0.0.0',
                self.port,
                process_request=self.process_request,
            )
            self._loop.run_until_complete(ws_server)
        except OSError as e:
            print(e)
        else:
            self._loop.run_forever()

    async def consumer_handler(
        self, client: websockets.WebSocketServerProtocol, room_id: str
    ) -> None:
        room_id = room_id.lstrip('/')
        if is_valid_uuid(room_id):
            response = asdict(self.gss.new_connection_request(client, room_id))
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
            message = json.loads(json_message)
        except json.JSONDecodeError as e:
            print(e)
            return
        updates = message['updates']
        latest_state = {
            'type': 'state',
            'data': self.gss.get_state(room_id),
        }

        for update in updates:
            try:
                latest_state = asdict(self.gss.process_update(update, room_id))
            except MessageError as err:
                print(err)
                await self.send_message_to_client(
                    {'error': err.message, 'request_id': message['request_id']}, client,
                )
        latest_state['request_id'] = message['request_id']
        await self.send_message_to_room(latest_state, room_id)


def start_websocket(host_port, room_store_dir):
    ws = WebsocketManager(host_port, room_store_dir)
    ws.start_server()

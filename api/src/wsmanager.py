import asyncio
import json
from dataclasses import asdict
from typing import Union
from uuid import UUID
from http import HTTPStatus

import websockets
from websockets.http import Headers

from game_state_server import Message, MessageContents


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
        self._client_ids = {}

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
            self._client_ids[hash(client)] = client
            response = asdict(self.gss.new_connection_request(hash(client), room_id))
            await self.send_message(response)
            try:
                async for message in client:
                    asyncio.ensure_future(self.consume(message, room_id, client))
            finally:
                self.gss.connection_dropped(client, room_id)
        else:
            print(f'Invalid uuid: {room_id}')

    async def send_message(self, message: Message):
        for target in message.targets:
            self._client_ids[target].send(json.dumps(asdict(message.contents)))

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

        try:
            async for reply in self.gss.process_updates(
                updates, room_id, hash(client), message['request_id']
            ):
                await self.send_message(reply)
        except Exception as err:
            print(err)
            await self.send_message(
                Message(
                    [hash(client)],
                    MessageContents(
                        'error', 'Something went wrong', message['request_id']
                    ),
                )
            )


def start_websocket(host_port, room_store_dir):
    ws = WebsocketManager(host_port, room_store_dir)
    ws.start_server()

import logging
import asyncio
import json
from dataclasses import asdict
from typing import Union, List, Tuple, Dict, Any
from uuid import UUID

import timber
import websockets
from websockets import ConnectionClosedError

from .game_state_server import Message, MessageContents, InvalidConnectionException
from .ws_close_codes import ERR_INVALID_UUID


def ignore_none(items: List[Tuple[str, Any]]) -> Dict[str, Any]:
    return dict(filter(lambda entry: entry[1] is not None, items))


def is_valid_uuid(uuid_string):
    try:
        val = UUID(uuid_string, version=4)
    except ValueError:
        return False
    return val.hex == uuid_string.replace('-', '')


logger = logging.getLogger(__name__)


class WebsocketManager:
    def __init__(self, port, gss):
        self.port = port
        self.gss = gss
        self._client_ids = {}

    async def start_websocket(self) -> None:
        try:
            await websockets.serve(
                self.consumer_handler, '0.0.0.0', self.port,
            )
        except OSError:
            logger.exception('Failed to start websocket server', exc_info=True)

    async def consumer_handler(
        self, client: websockets.WebSocketServerProtocol, room_id: str
    ) -> None:
        room_id = room_id.lstrip('/')
        if not is_valid_uuid(room_id):
            logger.info(f'Invalid room UUID: {room_id}')
            await client.close(
                code=ERR_INVALID_UUID, reason=f'Invalid room UUID: {room_id}'
            )
            return

        self._client_ids[hash(client)] = client
        try:
            response = await self.gss.new_connection_request(hash(client), room_id)
        except InvalidConnectionException as e:
            await client.close(e.close_code, e.reason)
            return

        await self.send_message(response)
        try:
            async for message in client:
                asyncio.ensure_future(self.consume(message, room_id, client))
        except ConnectionClosedError:
            # Disconnecting is a perfectly normal thing to happen, so just
            # continue cleaning up connection state
            pass
        finally:
            await self.gss.connection_dropped(hash(client), room_id)

    async def send_message(self, message: Message) -> None:
        for target in message.targets:
            client = self._client_ids.get(target)
            if client:
                await client.send(
                    json.dumps(asdict(message.contents, dict_factory=ignore_none))
                )
            else:
                logger.info(
                    f'Cannot send message to target: {target} because it does not exist'
                )

    async def consume(
        self,
        json_message: Union[str, bytes],
        room_id: str,
        client: websockets.WebSocketServerProtocol,
    ) -> None:
        try:
            message = json.loads(json_message)
        except json.JSONDecodeError:
            logger.info(
                'invalid json received from client',
                extra={"json": json_message},
                exc_info=True,
            )
            return

        updates = message['updates']
        request_id = message['request_id']
        client_id = hash(client)
        with timber.context(
            request={
                'room_id': room_id,
                'request_id': request_id,
                'client_id': client_id,
            }
        ):
            try:
                async for reply in self.gss.process_updates(
                    updates, room_id, client_id, request_id
                ):
                    await self.send_message(reply)
            except Exception:
                logger.exception('Failed to process updates', exc_info=True)
                await self.send_message(
                    Message(
                        [hash(client)],
                        MessageContents('error', 'Something went wrong', request_id),
                    )
                )

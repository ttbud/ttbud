import json
from dataclasses import asdict
from typing import Iterable, AsyncIterator

import botocore.exceptions
from aiobotocore.client import AioBaseClient

from src.api.api_structures import Action
from src.room_store.common import NoSuchRoomError
from src.room_store.json_to_actions import json_to_actions
from src.room_store.room_archive import RoomArchive

ROOM_DIR = 'rooms/'


def _room_id_to_key(room_id: str) -> str:
    return f'{ROOM_DIR}{room_id}'


class S3RoomArchive(RoomArchive):
    def __init__(self, client: AioBaseClient, bucket: str):
        self._client = client
        self._bucket = bucket

    async def get_all_room_ids(self) -> AsyncIterator[str]:
        paginator = self._client.get_paginator('list_objects')
        page_iterator = paginator.paginate(Bucket=self._bucket)
        async for page in page_iterator:
            for item in page.get('Contents', []):
                yield item['Key'].lstrip(ROOM_DIR)

    async def room_exists(self, room_id: str) -> bool:
        try:
            await self._client.head_object(
                Bucket=self._bucket, Key=_room_id_to_key(room_id)
            )
        except botocore.exceptions.ClientError as e:
            if e.response.get('Error', {}).get('Code', 'Unknown') == '404':
                return False
            raise
        return True

    async def read(self, room_id: str) -> Iterable[Action]:
        try:
            resp = await self._client.get_object(
                Bucket=self._bucket, Key=_room_id_to_key(room_id)
            )
        except botocore.exceptions.ClientError as e:
            if e.response.get('Error', {}).get('Code', 'Unknown') == 'NoSuchKey':
                raise NoSuchRoomError from e
            raise
        data = await resp['Body'].read()
        return json_to_actions([str(data.decode())])

    async def write(self, room_id: str, data: Iterable[Action]) -> None:
        await self._client.put_object(
            Bucket=self._bucket,
            Key=_room_id_to_key(room_id),
            Body=json.dumps(list(map(asdict, data))),
        )

    async def delete(self, room_id: str) -> None:
        await self._client.delete_object(
            Bucket=self._bucket, Key=_room_id_to_key(room_id)
        )

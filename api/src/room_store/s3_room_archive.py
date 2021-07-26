import asyncio
import json
from dataclasses import asdict
from typing import Iterable, AsyncIterator

import aiobotocore
import botocore.exceptions
from aiobotocore.client import AioBaseClient

from src.api.api_structures import Action
from src.room_store.json_to_actions import json_to_actions
from src.room_store.room_archive import RoomArchive
from tests.static_fixtures import VALID_ACTION

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
        except botocore.exceptions.ClientError:
            return False
        return True

    async def read(self, room_id: str) -> Iterable[Action]:
        resp = await self._client.get_object(
            Bucket=self._bucket, Key=_room_id_to_key(room_id)
        )
        data = await resp['Body'].read()
        print(data)
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


async def main():
    async with aiobotocore.get_session().create_client(
        's3',
        region_name='us-east-1',
        aws_access_key_id='AKIA5IUEAPMGQPSYFWUB',
        aws_secret_access_key='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',
    ) as client:
        archiver = S3RoomArchive(client, 'ttbud-prod')
        await archiver.delete('test_room_1')


if __name__ == '__main__':
    asyncio.run(main())

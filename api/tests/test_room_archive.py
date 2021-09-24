from asyncio import CancelledError
from contextlib import suppress
from typing import AsyncIterator, Callable, Iterator
from uuid import uuid4

import aiobotocore
import pytest
from aiobotocore.client import AioBaseClient

from localstack.services import infra
from pytest_lazyfixture import lazy_fixture

from src.room_store.common import NoSuchRoomError
from src.room_store.room_archive import RoomArchive
from src.room_store.s3_room_archive import S3RoomArchive
from src.util.async_util import async_collect
from tests.static_fixtures import VALID_ACTION, ANOTHER_VALID_ACTION

pytestmark = pytest.mark.asyncio


@pytest.fixture(scope='session')
def s3_url() -> Iterator[str]:
    infra.start_infra(asynchronous=True, apis=['s3'])
    yield 'http://localhost:4566'
    infra.stop_infra()


@pytest.fixture
async def s3_client(s3_url: str) -> AsyncIterator[AioBaseClient]:
    s3_client_context = aiobotocore.get_session().create_client(
        's3',
        region_name='us-east-1',
        endpoint_url=s3_url,
        aws_access_key_id='test',
        aws_secret_access_key='test',
    )
    with suppress(CancelledError):
        async with s3_client_context as s3_client:
            yield s3_client


@pytest.fixture
async def s3_room_archive(s3_client: AioBaseClient) -> S3RoomArchive:
    bucket = str(uuid4())
    await s3_client.create_bucket(Bucket=bucket)
    return S3RoomArchive(s3_client, bucket)


def any_room_archive(func: Callable) -> Callable:
    return pytest.mark.parametrize(
        'room_archive',
        [
            lazy_fixture('memory_room_archive'),
            lazy_fixture('s3_room_archive'),
        ],
    )(func)


@any_room_archive
async def test_get_all_room_ids(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [])
    await room_archive.write('another_room_id', [])
    room_ids = await async_collect(room_archive.get_all_room_ids())
    assert room_ids.sort() == ['test_room_id', 'another_room_id'].sort()


@any_room_archive
async def test_write_and_read(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [VALID_ACTION])
    assert list(await room_archive.read('test_room_id')) == [VALID_ACTION]


@any_room_archive
async def test_room_exists(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [])
    assert await room_archive.room_exists('test_room_id')
    assert not await room_archive.room_exists('nonexistent_room')


@any_room_archive
async def test_delete(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [])
    await room_archive.delete('test_room_id')
    assert not await room_archive.room_exists('test_room_id')


@any_room_archive
async def test_read_nonexistent_room(room_archive: RoomArchive) -> None:
    with pytest.raises(NoSuchRoomError):
        await room_archive.read('nonexistent_room')


@any_room_archive
async def test_read_empty_room(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [])
    assert list(await room_archive.read('test_room_id')) == []


@any_room_archive
async def test_delete_nonexistent_room(room_archive: RoomArchive) -> None:
    await room_archive.delete('nonexistent_room')


@any_room_archive
async def test_overwrite_room(room_archive: RoomArchive) -> None:
    await room_archive.write('test_room_id', [VALID_ACTION])
    await room_archive.write('test_room_id', [ANOTHER_VALID_ACTION])
    assert list(await room_archive.read('test_room_id')) == [ANOTHER_VALID_ACTION]

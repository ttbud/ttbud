# Clean up after a load test that didn't quit cleanly

import asyncio

from load.clear_load_test_rooms import clear_load_test_rooms
from src.config import config
from src.redis import create_redis_pool
from src.room_store.redis_room_store import create_redis_room_store
from src.util.json_serializer import JSONSerializer


async def main() -> None:
    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    json_serializer = JSONSerializer()
    async with create_redis_room_store(redis, json_serializer) as room_store:
        await clear_load_test_rooms(room_store)


if __name__ == '__main__':
    asyncio.run(main())

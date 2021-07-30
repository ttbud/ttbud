# Clean up after a load test that didn't quit cleanly

import asyncio

from load.clear_load_test_rooms import clear_load_test_rooms
from src.redis import create_redis_pool
from src.room_store.redis_room_store import create_redis_room_store
from src.config import config


async def main() -> None:
    redis = await create_redis_pool(config.redis_address, config.redis_ssl_validation)
    async with create_redis_room_store(redis) as room_store:
        await clear_load_test_rooms(room_store)


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
from traceback import print_exc

import aioredis
from dacite import from_dict

from src.game_components import Token
from src.room_store import RedisRoomStore, FileRoomStore
from src.config import config


async def migrate() -> None:
    file_store = FileRoomStore(config.room_store_dir)
    redis = await aioredis.create_redis_pool(config.redis_address)
    redis_store = RedisRoomStore(redis)

    async def migrate_room(target_room_id: str) -> None:
        try:
            token_dicts = await file_store.read_room_data(target_room_id)
            if token_dicts:
                tokens = []
                for token_dict in token_dicts:
                    tokens.append(from_dict(Token, token_dict))
                await redis_store.write_room_data(target_room_id, tokens)
        except Exception as e:
            print_exc()
            print("failed to migrate room", target_room_id, e)

    migrate_futures = []
    async for room_id in file_store.get_all_room_ids():
        migrate_futures.append(migrate_room(room_id))

    await asyncio.gather(*migrate_futures)
    redis.close()


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(migrate())

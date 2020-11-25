from typing import AsyncIterator, List, TypeVar


T = TypeVar('T')


async def async_collect(iterator: AsyncIterator[T]) -> List[T]:
    rtn = []
    async for item in iterator:
        rtn.append(item)
    return rtn

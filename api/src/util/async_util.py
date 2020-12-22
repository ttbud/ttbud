from __future__ import annotations

import asyncio
from asyncio import Future
from typing import TypeVar, AsyncIterable, AsyncIterator, Optional, List

_T = TypeVar('_T')


async def anext(iterator: AsyncIterator[_T]) -> _T:
    """
    Retrieve the next item from the `iterator`.
    If the iterator is exhausted, StopIteration is raised.
    """
    return await iterator.__anext__()


async def items_until(it: asyncio.Queue[_T], stop: asyncio.Future) -> AsyncIterator[_T]:
    """Yield items from the queue until the stop future is completed"""
    while True:
        q_task = asyncio.create_task(it.get())
        done, pending = await asyncio.wait(
            [q_task, stop], return_when=asyncio.FIRST_COMPLETED
        )
        if stop in done:
            return
        else:
            # MyPy does not know that the only task in done is the result of the queue
            yield next(iter(done)).result()  # type: ignore


async def race(*futures: Future[_T]) -> _T:
    """Return the result of the first task that completes"""
    if not futures:
        raise ValueError('Cannot race zero iterables')

    done, pending = await asyncio.wait(futures, return_when=asyncio.FIRST_COMPLETED)
    for fut in pending:
        fut.cancel()
    return next(iter(done)).result()


async def async_collect(
    iterator: AsyncIterable[_T], count: Optional[int] = None
) -> List[_T]:
    """
    Collect `count` items from `iterator` and return it as a list.

    If `count` is not specified, all items in `iterator` will be collected
    """
    rtn = []
    if count == 0:
        raise ValueError('Must collect at least one item')

    async for item in iterator:
        rtn.append(item)
        if count is not None and len(rtn) >= count:
            break

    return rtn

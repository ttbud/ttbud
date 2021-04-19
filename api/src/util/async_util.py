from __future__ import annotations

import asyncio
from asyncio import Future, CancelledError
from typing import TypeVar, AsyncIterable, AsyncIterator, Optional, List, cast

_T = TypeVar('_T')


async def anext(iterator: AsyncIterator[_T]) -> _T:
    """
    Retrieve the next item from the `iterator`.
    If the iterator is exhausted, StopIteration is raised.
    """
    return await iterator.__anext__()


def aiter(iterable: AsyncIterable[_T]) -> AsyncIterator[_T]:
    """Return the iterator object for the given iterable"""
    return iterable.__aiter__()


async def all_items(q: asyncio.Queue[_T]) -> AsyncIterator[_T]:
    """Create an indefinite iterator that contains all items the queue contains"""
    while True:
        yield await q.get()


async def items_until(it: AsyncIterable[_T], stop: asyncio.Future) -> AsyncIterator[_T]:
    """Yield items from the iterator until the stop future is completed"""
    it = aiter(it)
    while True:
        next_item_task = asyncio.create_task(it.__anext__())
        done, pending = await asyncio.wait(
            [next_item_task, stop], return_when=asyncio.FIRST_COMPLETED
        )

        if stop in done:
            next_item_task.cancel()
            try:
                # Await the task to ensure that the cancel finishes.
                # This should raise a CancelledError, which we ignore
                await next_item_task
            except CancelledError:
                pass
            await stop
            return
        else:
            # MyPy does not know that the only task in done is the next item in the
            # iterable
            yield cast(_T, next(iter(done)).result())


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

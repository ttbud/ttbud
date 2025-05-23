from __future__ import annotations

import asyncio
import contextlib
from asyncio import CancelledError, Future, Task
from collections.abc import AsyncIterable, AsyncIterator, Awaitable
from typing import (
    TypeVar,
    cast,
)

_T = TypeVar('_T')


async def end_task(task: Task) -> None:
    """
    Cancel a task and wait for it to complete cancellation
    """
    try:
        task.cancel()
        await task
    except CancelledError:
        pass


async def to_coroutine(awaitable: Awaitable[_T]) -> _T:
    """Transform any awaitable into a coroutine"""
    return await awaitable


async def items_until(it: AsyncIterable[_T], stop: asyncio.Future) -> AsyncIterator[_T]:
    """Yield items from the iterator until the stop future is completed"""
    it = aiter(it)
    while True:
        next_item_task: Task[_T] = asyncio.create_task(to_coroutine(it.__anext__()))
        done, pending = await asyncio.wait(
            [next_item_task, stop], return_when=asyncio.FIRST_COMPLETED
        )

        if stop in done:
            next_item_task.cancel()
            # Await the task to ensure that the cancel finishes.
            with contextlib.suppress(CancelledError):
                await next_item_task
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
    iterator: AsyncIterable[_T], count: int | None = None
) -> list[_T]:
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

from __future__ import annotations

import asyncio
from typing import TypeVar, AsyncIterator, Union

import pytest

from src.util.amerge import amerge, CompleteCondition
from src.util.async_util import async_collect, anext, race
from tests.helpers import to_async

pytestmark = pytest.mark.asyncio

QUEUE_END = object()
T = TypeVar('T')


async def queue_to_iterator(queue: asyncio.Queue[Union[T, object]]) -> AsyncIterator[T]:
    value = await queue.get()
    while value is not QUEUE_END:
        yield value
        value = await queue.get()


async def test_amerge_all_completed() -> None:
    combined = amerge(
        to_async([1, 2, 3]),
        to_async(['one', 'two', 'three']),
        complete_when=CompleteCondition.ALL_COMPLETED,
    )

    result = await async_collect(combined)
    # Results will be interleaved with no defined order, but results from each
    # iterator should still be in order
    numbers = list(filter(lambda item: isinstance(item, int), result))
    words = list(filter(lambda item: isinstance(item, str), result))

    assert numbers == [1, 2, 3]
    assert words == ['one', 'two', 'three']


async def test_amerge_first_completed() -> None:
    numbers_queue: asyncio.Queue[Union[int, object]] = asyncio.Queue()
    words_queue: asyncio.Queue[Union[str, object]] = asyncio.Queue()

    combined = amerge(
        queue_to_iterator(numbers_queue),
        queue_to_iterator(words_queue),
        complete_when=CompleteCondition.FIRST_COMPLETED,
    )

    await numbers_queue.put(1)
    assert await anext(combined) == 1

    await words_queue.put('one')
    assert await anext(combined) == 'one'

    # Finishing just one of the iterators should finish the combined one
    await numbers_queue.put(QUEUE_END)
    with pytest.raises(StopAsyncIteration):
        await anext(combined)

    await words_queue.put(QUEUE_END)


async def test_race():
    """Verify that race returns the first future that finishes and cancels the rest"""
    fut_one = asyncio.Future()
    fut_two = asyncio.Future()
    result = race(fut_one, fut_two)

    fut_one.set_result('Result One')
    assert await result == 'Result One'
    assert fut_two.cancelled(), 'pending future was not cancelled'


async def test_race_exception():
    """Verify that race raises an exception it is passed a future that does"""
    fut_one = asyncio.Future()
    fut_two = asyncio.Future()
    result = race(fut_one, fut_two)
    fut_two.set_exception(NotImplementedError())

    with pytest.raises(NotImplementedError):
        await result

    assert fut_one.cancelled(), 'Uncompleted future was not cancelled'


async def test_race_no_args():
    """Verify that race raises ValueError if no futures are provided"""
    with pytest.raises(ValueError):
        await race()

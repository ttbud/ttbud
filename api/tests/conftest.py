import asyncio

import pytest


@pytest.fixture(autouse=True)
def disable_sleep(mocker):
    """Disable sleep in all tests by default"""

    original_sleep = asyncio.sleep

    # We don't want to actually sleep for any amount of time, but we do want to
    # allow functions to yield the event loop, so convert all sleep calls to sleep(0)
    async def sleep(*args, **kwargs):
        await original_sleep(0)

    mocker.patch('asyncio.sleep', sleep)

import asyncio
import random
import time
from typing import Any

import pytest
from pytest_mock import MockerFixture


@pytest.fixture(autouse=True)
def disable_sleep(mocker: MockerFixture) -> None:
    """Disable sleep in all tests by default"""

    original_sleep = asyncio.sleep

    # We don't want to actually sleep for any amount of time, but we do want to
    # allow functions to yield the event loop, so convert all sleep calls to sleep(0)
    async def sleep(*args: Any, **kwargs: Any) -> None:
        await original_sleep(0)

    mocker.patch('asyncio.sleep', sleep)


@pytest.fixture(autouse=True)
def fix_monotonic(mocker: MockerFixture) -> None:
    """Time machine does not work with time.monotonic. Use time.time in tests instead"""
    mocker.patch('time.monotonic', time.time)


@pytest.fixture(autouse=True)
def fix_random() -> None:
    """Force a consistent seed so there's no randomness in tests"""
    random.seed(1)

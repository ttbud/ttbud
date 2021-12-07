import json
from typing import Callable, Awaitable
from dataclasses import asdict

from starlette.requests import Request
from starlette.responses import Response

from src.usage_stats import UsageStats


async def stats_endpoint(
    get_usage_info: Callable[[], Awaitable[UsageStats]], request: Request
) -> Response:
    return Response(json.dumps(asdict(await get_usage_info())))

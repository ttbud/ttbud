import ssl
from enum import Enum
from ssl import SSLContext
from typing import Union

import aioredis
from aioredis import Redis


class SSLValidation(Enum):
    # No SSL at all. Free heroku redis instances (which we use for staging) do not
    # support SSL
    NONE = 'none'
    # Use SSL, but disable cert verification.
    # Heroku's _paid_ redis plans (which we use in production) have self-signed certs
    # without a consistent key we can trust :(. If we ever start handling data that's
    # even remotely private, we'll have to find a better solution
    SELF_SIGNED = 'self_signed'
    # Full SSL verification
    DEFAULT = 'default'


async def create_redis_pool(address: str, ssl_validation: SSLValidation) -> Redis:
    ssl_context: Union[SSLContext, bool]
    if ssl_validation == SSLValidation.SELF_SIGNED:
        ssl_context = SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.VerifyMode.CERT_NONE
    elif ssl_validation == SSLValidation.NONE:
        ssl_context = False
    else:
        ssl_context = ssl.create_default_context()

    return await aioredis.create_redis_pool(address, ssl=ssl_context)

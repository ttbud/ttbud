from enum import Enum

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
    ssl_args: dict
    if ssl_validation == SSLValidation.SELF_SIGNED:
        ssl_args = {
            "ssl_check_hostname": False,
            "ssl_cert_reqs": "none",
        }
    elif ssl_validation == SSLValidation.NONE:
        ssl_args = {}
    else:
        ssl_args = {"ssl_check_hostname": True}

    return Redis.from_url(address, **ssl_args)

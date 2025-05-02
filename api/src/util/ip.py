import ipaddress
from collections.abc import Mapping


def get_client_ip(remote_ip: str, headers: Mapping[str, str]) -> str:
    # It's okay to trust X-FORWARDED-FOR because we deploy in heroku which
    # means our application is not reachable except through the trusted load balancer
    xff = headers.get('X-FORWARDED-FOR', '')
    last_xff_ip = xff.split(',').pop().strip()

    try:
        return str(ipaddress.ip_address(last_xff_ip))
    except ValueError:
        return str(ipaddress.ip_address(remote_ip))

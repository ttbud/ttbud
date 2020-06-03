import os
from dataclasses import dataclass
from enum import Enum


class Environment(Enum):
    DEV = 'dev'
    STAGING = 'staging'
    PROD = 'prod'


_scout_key = os.environ.get('SCOUT_KEY')


@dataclass
class Config:
    environment: Environment = Environment[os.environ['ENVIRONMENT'].upper()]
    websocket_port: int = int(os.environ['PORT'])
    room_store_dir: str = os.environ['ROOM_STORE_DIR']
    json_logs: bool = os.environ.get('JSON_LOGS') == 'true'
    scout_config = {
        'name': f'ttbud ({environment.value})',
        'key': _scout_key,
        'monitor': os.environ.get('SCOUT_MONITOR') == 'true',
    }
    log_config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {'()': 'timber.formatter.TimberFormatter'},
            'simple': {'format': '%(levelname)s %(message)s'},
        },
        'handlers': {
            'stdout': {
                'level': 'INFO',
                'class': 'logging.StreamHandler',
                'formatter': 'json' if json_logs else 'simple',
            }
        },
        'loggers': {'': {'handlers': ['stdout'], 'level': 'INFO'}},
    }


config = Config()

import os
from dataclasses import dataclass
from enum import Enum
from typing import Optional

from src.redis import SSLValidation


class Environment(Enum):
    DEV = 'dev'
    STAGING = 'staging'
    PROD = 'prod'


_use_ssl = os.environ.get('USE_SSL') == 'true'


@dataclass
class CertConfig:
    key_file_path: str = os.environ['SSL_KEY_FILE']
    cert_file_path: str = os.environ['SSL_CRT_FILE']


@dataclass
class Config:
    environment: Environment = Environment[os.environ['ENVIRONMENT'].upper()]
    websocket_port: int = int(os.environ['PORT'])
    room_store_dir: str = os.environ['ROOM_STORE_DIR']
    redis_address = os.environ['REDIS_URL']
    use_redis: bool = os.environ.get('USE_REDIS') == 'true'
    json_logs: bool = os.environ.get('JSON_LOGS') == 'true'
    cert_config: Optional[CertConfig] = CertConfig() if _use_ssl else None
    redis_ssl_validation: SSLValidation = SSLValidation[
        os.environ.get('REDIS_SSL_VALIDATION', 'default').upper()
    ]
    scout_config = {
        'name': f'ttbud ({environment.value})',
        'key': os.environ.get('SCOUT_KEY'),
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

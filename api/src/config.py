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
    key_file_path: str
    cert_file_path: str


@dataclass
class Config:
    environment: Environment = Environment[os.environ['ENVIRONMENT'].upper()]
    websocket_port: int = int(os.environ['PORT'])
    redis_address = os.environ['REDIS_URL']
    json_logs: bool = os.environ.get('JSON_LOGS') == 'true'
    bypass_rate_limit_key: str = os.environ['BYPASS_RATE_LIMIT_KEY']
    cert_config: Optional[CertConfig] = (
        CertConfig(
            key_file_path=os.environ['SSL_KEY_FILE'],
            cert_file_path=os.environ['SSL_CRT_FILE'],
        )
        if _use_ssl
        else None
    )
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
        'root': {'level': 'INFO', 'handlers': ['stdout']},
        'formatters': {
            'json': {'()': 'src.util.detailed_formatter.DetailedFormatter'},
            'simple': {'format': '%(levelname)s %(message)s'},
        },
        'handlers': {
            'stdout': {
                'level': os.environ.get('LOG_LEVEL', 'INFO'),
                'class': 'logging.StreamHandler',
                'formatter': 'json' if json_logs else 'simple',
            }
        },
        'loggers': {
            '': {'handlers': ['stdout'], 'level': 'INFO'},
            'scout_apm': {
                'level': 'INFO',
                'handlers': ['stdout'],
                'propagate': True,
            },
            'gunicorn.error': {
                'level': 'INFO',
                'handlers': ['stdout'],
                'qualname': 'gunicorn.access',
            },
            'gunicorn.access': {
                'level': 'INFO',
                'handlers': ['stdout'],
                'qualname': 'gunicorn.access',
            },
        },
    }


config = Config()

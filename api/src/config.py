import os
from dataclasses import dataclass, field
from enum import Enum

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
    # When you use the cheapest heroku redis plan, the 'REDIS_URL' environment variable
    # is a plaintext URI for backwards-compatibility reasons, so you have to use
    # 'REDIS_TLS_URL' to get a TLS connection if it's available
    # In production we use a slightly more expensive plan, which provides a TLS
    # connection for the 'REDIS_URL' environment variable, but doesn't provide a
    # REDIS_TLS_URL environment variable
    redis_address = os.environ.get('REDIS_TLS_URL', os.environ['REDIS_URL'])
    json_logs: bool = os.environ.get('JSON_LOGS') == 'true'
    bypass_rate_limit_key: str = os.environ['BYPASS_RATE_LIMIT_KEY']
    aws_region: str = os.environ['AWS_REGION']
    aws_key_id: str = os.environ['AWS_KEY_ID']
    aws_secret_key: str = os.environ['AWS_SECRET_KEY']
    aws_bucket: str = os.environ['AWS_BUCKET']
    aws_endpoint: str | None = os.environ.get('AWS_ENDPOINT')
    cert_config: CertConfig | None = field(
        default_factory=lambda: CertConfig(
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

import os

websocket_port = int(os.environ['PORT'])
room_store_dir = os.environ['ROOM_STORE_DIR']
json_logs = os.environ.get('JSON_LOGS') == 'true'

formatter = 'json' if json_logs else 'simple'
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
            'formatter': formatter,
        }
    },
    'loggers': {'': {'handlers': ['stdout'], 'level': 'INFO'}},
}

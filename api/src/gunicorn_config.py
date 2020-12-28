import multiprocessing

from src.config import config, Environment

_is_dev = config.environment == Environment.DEV

gunicorn_config = {
    'logconfig_dict': config.log_config,
    'keyfile': config.cert_config.key_file_path if config.cert_config else None,
    'certfile': config.cert_config.cert_file_path if config.cert_config else None,
    'bind': [f'0.0.0.0:{config.websocket_port}'],
    'reload': _is_dev,
    'workers': 1 if _is_dev else multiprocessing.cpu_count(),
    'worker_class': 'uvicorn.workers.UvicornWorker',
}

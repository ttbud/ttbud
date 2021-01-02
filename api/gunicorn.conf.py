import multiprocessing

from src.config import config as app_config

logconfig_dict = app_config.log_config
keyfile = app_config.cert_config.key_file_path if app_config.cert_config else None
certfile = app_config.cert_config.cert_file_path if app_config.cert_config else None
bind = f'0.0.0.0:{app_config.websocket_port}'
workers = multiprocessing.cpu_count()
worker_class = 'uvicorn.workers.UvicornWorker'

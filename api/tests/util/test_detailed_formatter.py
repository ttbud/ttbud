import json
import logging
from dataclasses import dataclass
from typing import List, Dict

import pytest

from src.util.detailed_formatter import DetailedFormatter
from tests.helpers import assert_all_match


class RecordingLogHandler(logging.Handler):
    """Log handler that records """

    def __init__(self):
        super().__init__()
        self.lines = []

    def emit(self, record):
        self.lines.append(self.format(record))


@dataclass
class LogContext:
    logger: logging.Logger
    lines: List[str]


@pytest.fixture
def log_context():
    logger = logging.getLogger('test')
    logger.setLevel(logging.DEBUG)
    logger.handlers = []
    handler = RecordingLogHandler()
    handler.setFormatter(DetailedFormatter())
    logger.addHandler(handler)
    return LogContext(logger, handler.lines)


def test_allows_messages_without_exceptions(log_context: LogContext):
    log_context.logger.debug('test')
    assert_all_match(decoded_lines(log_context.lines), [{'message': 'test'}])


def test_includes_exception_details(log_context: LogContext):
    try:
        raise Exception('exception message')
    except Exception:
        log_context.logger.exception('test', exc_info=True)

    assert_all_match(
        decoded_lines(log_context.lines),
        [
            {
                'message': 'test',
                'exception': {
                    'msg': 'exception message',
                    'traceback': [{'function': 'test_includes_exception_details'}],
                },
            }
        ],
    )


def decoded_lines(lines: List[str]) -> List[Dict]:
    return [json.loads(line) for line in lines]

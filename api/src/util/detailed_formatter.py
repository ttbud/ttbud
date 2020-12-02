import traceback
from logging import LogRecord
from types import TracebackType
from typing import Dict, List, Optional

from timber.formatter import TimberFormatter


def _jsonable_traceback(tb: Optional[TracebackType]) -> List[Dict[str, str]]:
    frames: List[Dict[str, str]] = []
    stack = traceback.extract_tb(tb, limit=10)
    for frame in stack:
        frames.append(
            {
                'file': frame.filename,
                'function': frame.name,
                'line_number': str(frame.lineno),
                'line': frame.line,
            }
        )

    return frames


class DetailedFormatter(TimberFormatter):
    """TimberFormatter that includes exception stack traces"""

    def format(self, record: LogRecord) -> str:
        if record.exc_info:
            (typ, msg, tb) = record.exc_info
            record.__dict__['exception'] = {
                'type': typ.__name__ if typ else 'Unknown',
                'msg': str(msg),
                'traceback': _jsonable_traceback(tb),
            }
        return super().format(record)

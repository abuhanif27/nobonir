import json
import logging
from contextlib import contextmanager
from time import perf_counter


logger = logging.getLogger("nobonir.performance")


@contextmanager
def capture_performance(label: str, extra: dict | None = None):
    start = perf_counter()
    try:
        yield
    finally:
        duration_ms = round((perf_counter() - start) * 1000, 2)
        payload = {
            "event": "performance",
            "label": label,
            "duration_ms": duration_ms,
        }
        if extra:
            payload.update(extra)
        logger.info(json.dumps(payload))
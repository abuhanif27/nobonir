import json
import logging
from time import perf_counter
from uuid import uuid4


logger = logging.getLogger("nobonir.request")


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = str(uuid4())
        request.request_id = request_id
        start = perf_counter()

        response = self.get_response(request)

        duration_ms = round((perf_counter() - start) * 1000, 2)
        response["X-Request-ID"] = request_id
        response["Server-Timing"] = f"app;dur={duration_ms}"

        if request.path.startswith("/api/"):
            logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.path,
                        "status_code": response.status_code,
                        "duration_ms": duration_ms,
                    }
                )
            )

        return response
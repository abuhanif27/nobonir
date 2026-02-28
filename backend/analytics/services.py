from __future__ import annotations

from typing import Any

from .models import AnalyticsEvent


def track_analytics_event(
    event_name: str,
    *,
    source: str = AnalyticsEvent.Source.BACKEND,
    metadata: dict[str, Any] | None = None,
    request=None,
    user=None,
    path: str = "",
):
    resolved_user = user
    if resolved_user is None and request is not None:
        req_user = getattr(request, "user", None)
        if getattr(req_user, "is_authenticated", False):
            resolved_user = req_user

    session_key = ""
    if request is not None and hasattr(request, "session"):
        if not request.session.session_key:
            request.session.save()
        session_key = request.session.session_key or ""

    resolved_path = path or (request.path if request is not None else "")

    return AnalyticsEvent.objects.create(
        event_name=(event_name or "").strip(),
        source=source,
        user=resolved_user,
        session_key=session_key,
        path=resolved_path,
        metadata=metadata or {},
    )

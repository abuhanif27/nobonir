from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminRole
from .models import AnalyticsEvent
from .serializers import AnalyticsEventIngestSerializer
from .services import track_analytics_event


class AnalyticsEventIngestAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AnalyticsEventIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        track_analytics_event(
            event_name=data["event_name"],
            source=data.get("source") or "frontend",
            metadata=data.get("metadata") or {},
            path=data.get("path") or request.path,
            request=request,
        )

        return Response({"received": True}, status=status.HTTP_201_CREATED)


class AnalyticsSummaryAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    FUNNEL_ORDER = [
        "view_product",
        "add_to_cart",
        "begin_checkout",
        "order_created",
        "payment_success",
        "review_submitted",
    ]

    def get(self, request):
        try:
            days = int(request.query_params.get("days", 7))
        except (TypeError, ValueError):
            return Response({"detail": "days must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        if days <= 0 or days > 90:
            return Response({"detail": "days must be between 1 and 90."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        start = now - timedelta(days=days)

        queryset = AnalyticsEvent.objects.filter(
            created_at__gte=start,
            event_name__in=self.FUNNEL_ORDER,
        )

        total_counts_qs = (
            queryset.values("event_name")
            .annotate(count=Count("id"))
            .order_by("event_name")
        )
        total_counts = {row["event_name"]: row["count"] for row in total_counts_qs}

        per_day_rows = (
            queryset.annotate(day=TruncDate("created_at"))
            .values("day", "event_name")
            .annotate(count=Count("id"))
            .order_by("day", "event_name")
        )

        daily_map = {}
        for row in per_day_rows:
            day_key = row["day"].isoformat()
            if day_key not in daily_map:
                daily_map[day_key] = {name: 0 for name in self.FUNNEL_ORDER}
            daily_map[day_key][row["event_name"]] = row["count"]

        daily = []
        for day in sorted(daily_map.keys()):
            counts = daily_map[day]
            daily.append(
                {
                    "date": day,
                    "counts": counts,
                    "rates": self._build_rates(counts),
                }
            )

        totals_with_defaults = {name: total_counts.get(name, 0) for name in self.FUNNEL_ORDER}

        return Response(
            {
                "window": {
                    "days": days,
                    "from": start.isoformat(),
                    "to": now.isoformat(),
                },
                "events": self.FUNNEL_ORDER,
                "totals": totals_with_defaults,
                "rates": self._build_rates(totals_with_defaults),
                "daily": daily,
            },
            status=status.HTTP_200_OK,
        )

    def _pct(self, numerator: int, denominator: int):
        if denominator <= 0:
            return None
        return round((numerator / denominator) * 100, 2)

    def _build_rates(self, counts):
        return {
            "view_to_add_to_cart_pct": self._pct(counts["add_to_cart"], counts["view_product"]),
            "add_to_cart_to_begin_checkout_pct": self._pct(counts["begin_checkout"], counts["add_to_cart"]),
            "begin_checkout_to_order_created_pct": self._pct(counts["order_created"], counts["begin_checkout"]),
            "order_created_to_payment_success_pct": self._pct(counts["payment_success"], counts["order_created"]),
            "payment_success_to_review_submitted_pct": self._pct(counts["review_submitted"], counts["payment_success"]),
        }

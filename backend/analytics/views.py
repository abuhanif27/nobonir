from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

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

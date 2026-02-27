from django.urls import path

from .views import AnalyticsEventIngestAPIView, AnalyticsSummaryAPIView

urlpatterns = [
    path("events/", AnalyticsEventIngestAPIView.as_view()),
    path("summary/", AnalyticsSummaryAPIView.as_view()),
]

from django.urls import path

from .views import AnalyticsEventIngestAPIView

urlpatterns = [
    path("events/", AnalyticsEventIngestAPIView.as_view()),
]

from django.urls import path

from .views import ReviewListCreateAPIView

urlpatterns = [
    path("", ReviewListCreateAPIView.as_view()),
]

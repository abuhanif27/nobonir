from django.urls import path

from .views import RecommendationAPIView, SearchAPIView, SentimentAPIView

urlpatterns = [
    path("recommendations/", RecommendationAPIView.as_view()),
    path("search/", SearchAPIView.as_view()),
    path("sentiment/", SentimentAPIView.as_view()),
]

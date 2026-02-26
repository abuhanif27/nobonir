from django.urls import path

from .views import (
    PersonalizedRecommendationAPIView,
    PreferenceTrainAPIView,
    RecommendationAPIView,
    SearchAPIView,
    SentimentAPIView,
    UserPreferenceAPIView,
)

urlpatterns = [
    path("recommendations/", RecommendationAPIView.as_view()),
    path("recommendations/personalized/", PersonalizedRecommendationAPIView.as_view()),
    path("preferences/", UserPreferenceAPIView.as_view()),
    path("preferences/train/", PreferenceTrainAPIView.as_view()),
    path("search/", SearchAPIView.as_view()),
    path("sentiment/", SentimentAPIView.as_view()),
]

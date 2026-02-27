from django.urls import path

from .views import AdminReviewModerationViewSet, MyReviewDetailAPIView, MyReviewListAPIView, ReviewEligibilityAPIView, ReviewListCreateAPIView

urlpatterns = [
    path("", ReviewListCreateAPIView.as_view()),
    path("can-review/", ReviewEligibilityAPIView.as_view()),
    path("my/", MyReviewListAPIView.as_view()),
    path("my/<int:pk>/", MyReviewDetailAPIView.as_view()),
    path("admin/", AdminReviewModerationViewSet.as_view({"get": "list"})),
    path("admin/<int:pk>/", AdminReviewModerationViewSet.as_view({"patch": "partial_update", "delete": "destroy", "get": "retrieve"})),
]

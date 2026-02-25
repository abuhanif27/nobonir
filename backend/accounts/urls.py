from django.urls import path

from .views import MeAPIView, PasswordChangeAPIView, RegisterAPIView, UserListAPIView

urlpatterns = [
    path("register/", RegisterAPIView.as_view()),
    path("me/", MeAPIView.as_view()),
    path("me/change-password/", PasswordChangeAPIView.as_view()),
    path("users/", UserListAPIView.as_view()),
]

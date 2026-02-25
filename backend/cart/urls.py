from django.urls import path

from .views import CartItemAPIView, CartOverviewAPIView, WishlistItemAPIView, WishlistOverviewAPIView

urlpatterns = [
    path("", CartOverviewAPIView.as_view()),
    path("items/", CartItemAPIView.as_view()),
    path("items/<int:item_id>/", CartItemAPIView.as_view()),
    path("wishlist/", WishlistOverviewAPIView.as_view()),
    path("wishlist/<int:item_id>/", WishlistItemAPIView.as_view()),
]

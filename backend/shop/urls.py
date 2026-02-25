from django.urls import path

from .views import (
    CartAPIView,
    CartItemAPIView,
    CategoryListAPIView,
    CheckoutAPIView,
    OrderDetailAPIView,
    OrderListAPIView,
    ProductDetailAPIView,
    ProductListAPIView,
    ProductReviewAPIView,
    RecommendationAPIView,
    WishlistAPIView,
    WishlistItemAPIView,
    health,
)

urlpatterns = [
    path('health/', health),
    path('categories/', CategoryListAPIView.as_view()),
    path('products/', ProductListAPIView.as_view()),
    path('products/<int:product_id>/', ProductDetailAPIView.as_view()),
    path('products/<int:product_id>/reviews/', ProductReviewAPIView.as_view()),
    path('wishlist/', WishlistAPIView.as_view()),
    path('wishlist/<int:item_id>/', WishlistItemAPIView.as_view()),
    path('cart/', CartAPIView.as_view()),
    path('cart/<int:item_id>/', CartItemAPIView.as_view()),
    path('checkout/', CheckoutAPIView.as_view()),
    path('orders/', OrderListAPIView.as_view()),
    path('orders/<int:order_id>/', OrderDetailAPIView.as_view()),
    path('ai/recommendations/', RecommendationAPIView.as_view()),
]

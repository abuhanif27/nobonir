from django.urls import path

from .views import AdminOrderViewSet, CheckoutAPIView, CouponValidateAPIView, MyOrderListAPIView

urlpatterns = [
    path("checkout/", CheckoutAPIView.as_view()),
    path("coupon/validate/", CouponValidateAPIView.as_view()),
    path("my/", MyOrderListAPIView.as_view()),
    path("admin/", AdminOrderViewSet.as_view({"get": "list"})),
    path("admin/<int:pk>/", AdminOrderViewSet.as_view({"patch": "partial_update", "get": "retrieve"})),
]

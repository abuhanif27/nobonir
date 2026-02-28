from django.urls import path

from .views import (
    AdminOrderInvoicePDFAPIView,
    AdminCouponViewSet,
    AdminOrderViewSet,
    CheckoutAPIView,
    CouponValidateAPIView,
    MyOrderInvoiceAPIView,
    MyOrderInvoicePDFAPIView,
    MyOrderListAPIView,
    MyOrderStatusStreamAPIView,
)

urlpatterns = [
    path("checkout/", CheckoutAPIView.as_view()),
    path("coupon/validate/", CouponValidateAPIView.as_view()),
    path("my/", MyOrderListAPIView.as_view()),
    path("my/updates/stream/", MyOrderStatusStreamAPIView.as_view()),
    path("my/<int:order_id>/invoice/", MyOrderInvoiceAPIView.as_view()),
    path("my/<int:order_id>/invoice.pdf/", MyOrderInvoicePDFAPIView.as_view()),
    path("admin/coupons/", AdminCouponViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "admin/coupons/<int:pk>/",
        AdminCouponViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
    ),
    path("admin/<int:order_id>/invoice.pdf/", AdminOrderInvoicePDFAPIView.as_view()),
    path("admin/", AdminOrderViewSet.as_view({"get": "list"})),
    path("admin/<int:pk>/", AdminOrderViewSet.as_view({"patch": "partial_update", "get": "retrieve"})),
]

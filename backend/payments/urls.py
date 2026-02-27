from django.urls import path

from .views import CODPaymentAPIView, PaymentSimulationAPIView, StripeCancelPaymentAPIView, StripeCheckoutSessionAPIView, StripeWebhookAPIView

urlpatterns = [
    path("simulate/", PaymentSimulationAPIView.as_view()),
    path("cod/confirm/", CODPaymentAPIView.as_view()),
    path("stripe/checkout-session/", StripeCheckoutSessionAPIView.as_view()),
    path("stripe/cancel/", StripeCancelPaymentAPIView.as_view()),
    path("stripe/webhook/", StripeWebhookAPIView.as_view()),
]

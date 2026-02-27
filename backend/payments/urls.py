from django.urls import path

from .views import PaymentSimulationAPIView, StripeCheckoutSessionAPIView, StripeWebhookAPIView

urlpatterns = [
    path("simulate/", PaymentSimulationAPIView.as_view()),
    path("stripe/checkout-session/", StripeCheckoutSessionAPIView.as_view()),
    path("stripe/webhook/", StripeWebhookAPIView.as_view()),
]

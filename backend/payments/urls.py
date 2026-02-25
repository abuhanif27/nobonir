from django.urls import path

from .views import PaymentSimulationAPIView

urlpatterns = [
    path("simulate/", PaymentSimulationAPIView.as_view()),
]

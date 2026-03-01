import os
from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    name = 'payments'
    path = os.path.dirname(os.path.abspath(__file__))

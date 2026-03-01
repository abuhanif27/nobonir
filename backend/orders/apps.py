import os
from django.apps import AppConfig


class OrdersConfig(AppConfig):
    name = 'orders'
    path = os.path.dirname(os.path.abspath(__file__))

import os
from django.apps import AppConfig


class CartConfig(AppConfig):
    name = 'cart'
    path = os.path.dirname(os.path.abspath(__file__))

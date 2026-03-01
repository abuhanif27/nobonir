import os
from django.apps import AppConfig


class ShopConfig(AppConfig):
    name = 'shop'
    path = os.path.dirname(os.path.abspath(__file__))

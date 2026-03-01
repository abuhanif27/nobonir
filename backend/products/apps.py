import os
from django.apps import AppConfig


class ProductsConfig(AppConfig):
    name = 'products'
    path = os.path.dirname(os.path.abspath(__file__))

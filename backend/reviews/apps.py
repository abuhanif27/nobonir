import os
from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    name = 'reviews'
    path = os.path.dirname(os.path.abspath(__file__))

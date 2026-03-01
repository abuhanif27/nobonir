import os
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'
    path = os.path.dirname(os.path.abspath(__file__))

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
	fieldsets = UserAdmin.fieldsets + (
		("Profile", {"fields": ("role", "gender", "date_of_birth", "phone_number", "address", "profile_picture")}),
	)
	list_display = ("username", "email", "role", "gender", "is_staff", "is_active")

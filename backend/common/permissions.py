from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        return bool(user.role == "ADMIN" or user.is_staff or user.is_superuser)


class IsCustomerRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        # Allow admins/staff to act as customers for testing
        if user.role == "ADMIN" or user.is_staff or user.is_superuser:
            return True
        return bool(user.role == "CUSTOMER")

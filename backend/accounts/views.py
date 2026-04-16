from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from datetime import timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from common.permissions import IsAdminRole
from accounts.models import PasswordResetToken
from accounts.services.email_service import EmailService
from .serializers import (
	AdminUserSerializer,
	AdminUserUpdateSerializer,
	EmailTokenObtainSerializer,
	PasswordChangeSerializer,
	PasswordResetRequestSerializer,
	PasswordResetConfirmSerializer,
	ProfileUpdateSerializer,
	RegisterSerializer,
	UserSerializer,
)

User = get_user_model()


class LoginAPIView(TokenObtainPairView):
	"""
	Custom login view that merges guest cart with user cart after authentication.
	"""
	permission_classes = [permissions.AllowAny]
	serializer_class = EmailTokenObtainSerializer

	def post(self, request, *args, **kwargs):
		# Get session key before authentication
		session_key = request.session.session_key
		
		# Call parent to authenticate and get tokens
		response = super().post(request, *args, **kwargs)
		
		# If login successful and there was a session, merge guest cart
		if response.status_code == 200 and session_key:
			try:
				# Import here to avoid circular imports
				from cart.utils import merge_guest_cart_to_user
				
				# Get user from token data
				email = request.data.get('email')
				user = User.objects.filter(email=email).first()
				
				if user:
					merge_guest_cart_to_user(session_key, user)
			except Exception:
				# Don't fail login if cart merge fails
				pass
		
		return response


class RegisterAPIView(generics.CreateAPIView):
	serializer_class = RegisterSerializer
	permission_classes = [permissions.AllowAny]
	
	def create(self, request, *args, **kwargs):
		response = super().create(request, *args, **kwargs)
		
		# Send welcome email to new user
		if response.status_code == 201:
			try:
				email = response.data.get('email')
				user = User.objects.get(email=email)
				EmailService.send_welcome_email(user)
			except Exception:
				# Don't fail registration if welcome email fails
				pass
		
		return response


class MeAPIView(generics.RetrieveUpdateAPIView):
	permission_classes = [permissions.IsAuthenticated]

	def get_object(self):
		return self.request.user

	def get_serializer_class(self):
		if self.request.method in ['PUT', 'PATCH']:
			return ProfileUpdateSerializer
		return UserSerializer


class PasswordChangeAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
		if serializer.is_valid():
			user = serializer.save()
			
			# Send password changed confirmation email
			EmailService.send_password_changed_confirmation(user)
			
			return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestAPIView(APIView):
	"""Request a password reset link via email."""
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = PasswordResetRequestSerializer(data=request.data)
		if serializer.is_valid():
			email = serializer.validated_data['email']
			user = User.objects.filter(email__iexact=email).first()
			
			if user:
				# Create reset token
				token = PasswordResetToken.generate_token()
				expiry_hours = int(getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRY_HOURS', 24))
				expires_at = timezone.now() + timedelta(hours=expiry_hours)
				
				reset_token = PasswordResetToken.objects.create(
					user=user,
					token=token,
					expires_at=expires_at
				)
				
				# Send password reset email using EmailService
				EmailService.send_password_reset_email(
					user=user,
					reset_token=token,
					expiry_hours=expiry_hours
				)
			
			# Always return success for security (don't reveal if email exists)
			return Response(
				{"detail": "If an account exists with this email, you will receive a password reset link."},
				status=status.HTTP_200_OK
			)
		
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmAPIView(APIView):
	"""Confirm password reset with token and new password."""
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = PasswordResetConfirmSerializer(data=request.data)
		if serializer.is_valid():
			user = serializer.save()
			return Response(
				{
					"detail": "Password has been reset successfully. You can now login with your new password.",
					"user": {
						"id": user.id,
						"email": user.email,
						"username": user.username
					}
				},
				status=status.HTTP_200_OK
			)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListAPIView(generics.ListAPIView):
	serializer_class = AdminUserSerializer
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = User.objects.all().order_by("id")

	def get_queryset(self):
		queryset = self.queryset
		search = self.request.query_params.get("search", "").strip()
		role = self.request.query_params.get("role", "").strip().upper()
		status_filter = self.request.query_params.get("status", "").strip().lower()

		if search:
			queryset = queryset.filter(
				Q(email__icontains=search)
				| Q(first_name__icontains=search)
				| Q(last_name__icontains=search)
				| Q(username__icontains=search)
			)

		if role in {"ADMIN", "CUSTOMER"}:
			queryset = queryset.filter(role=role)

		if status_filter == "active":
			queryset = queryset.filter(is_active=True)
		elif status_filter == "inactive":
			queryset = queryset.filter(is_active=False)

		return queryset


class UserAdminDetailAPIView(generics.RetrieveUpdateAPIView):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = User.objects.all()
	serializer_class = AdminUserUpdateSerializer

	@staticmethod
	def _is_main_admin(user):
		return bool(user.role == User.Role.ADMIN and user.is_superuser and user.is_active)

	def _would_break_last_main_admin(self, instance, payload):
		if not self._is_main_admin(instance):
			return False

		next_role = payload.get("role", instance.role)
		next_active = payload.get("is_active", instance.is_active)
		next_is_staff = payload.get("is_staff", instance.is_staff)

		still_main_admin = (
			next_role == User.Role.ADMIN
			and bool(next_active)
			and bool(next_is_staff)
			and instance.is_superuser
		)
		if still_main_admin:
			return False

		main_admin_count = User.objects.filter(
			role=User.Role.ADMIN,
			is_superuser=True,
			is_active=True,
		).count()

		return main_admin_count <= 1

	def patch(self, request, *args, **kwargs):
		instance = self.get_object()
		next_role = request.data.get("role", instance.role)

		if request.user.id == instance.id and request.data.get("is_active") is False:
			return Response({"detail": "You cannot deactivate your own account."}, status=status.HTTP_400_BAD_REQUEST)

		is_demoting_admin = (
			instance.role == User.Role.ADMIN
			and next_role != User.Role.ADMIN
		)
		if is_demoting_admin and not request.user.is_superuser:
			return Response(
				{"detail": "Only a super admin can remove admin role from a user."},
				status=status.HTTP_403_FORBIDDEN,
			)

		if self._would_break_last_main_admin(instance, request.data):
			return Response(
				{"detail": "At least one active main super admin is required."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		response = super().patch(request, *args, **kwargs)
		return Response(AdminUserSerializer(self.get_object()).data, status=response.status_code)

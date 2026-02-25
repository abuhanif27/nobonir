from django.contrib.auth import get_user_model
from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView

from common.permissions import IsAdminRole
from .serializers import EmailTokenObtainSerializer, RegisterSerializer, UserSerializer

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


class MeAPIView(generics.RetrieveUpdateAPIView):
	serializer_class = UserSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_object(self):
		return self.request.user


class UserListAPIView(generics.ListAPIView):
	serializer_class = UserSerializer
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = User.objects.all().order_by("id")

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions

from common.permissions import IsAdminRole
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


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

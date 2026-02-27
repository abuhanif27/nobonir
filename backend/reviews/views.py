from rest_framework import generics, permissions
from rest_framework import viewsets

from common.permissions import IsAdminRole
from common.permissions import IsCustomerRole
from .models import Review
from .serializers import AdminReviewSerializer, MyReviewSerializer, ReviewSerializer


class ReviewListCreateAPIView(generics.ListCreateAPIView):
	serializer_class = ReviewSerializer
	queryset = Review.objects.select_related("user", "product", "product__category").all()
	filterset_fields = ["product"]

	def get_queryset(self):
		queryset = self.queryset
		if self.request.method == "GET":
			queryset = queryset.filter(is_approved=True)
		return queryset

	def get_permissions(self):
		if self.request.method == "POST":
			return [permissions.IsAuthenticated(), IsCustomerRole()]
		return [permissions.AllowAny()]

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)


class MyReviewListAPIView(generics.ListAPIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]
	serializer_class = MyReviewSerializer

	def get_queryset(self):
		return Review.objects.select_related("product").filter(user=self.request.user).order_by("-created_at")


class MyReviewDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]
	serializer_class = ReviewSerializer

	def get_queryset(self):
		return Review.objects.select_related("product").filter(user=self.request.user)


class AdminReviewModerationViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = Review.objects.select_related("user", "product").all().order_by("-created_at")
	serializer_class = AdminReviewSerializer
	http_method_names = ["get", "patch", "delete", "head", "options"]

from rest_framework import generics, permissions

from common.permissions import IsCustomerRole
from .models import Review
from .serializers import ReviewSerializer


class ReviewListCreateAPIView(generics.ListCreateAPIView):
	serializer_class = ReviewSerializer
	queryset = Review.objects.select_related("user", "product", "product__category").all()
	filterset_fields = ["product"]

	def get_permissions(self):
		if self.request.method == "POST":
			return [permissions.IsAuthenticated(), IsCustomerRole()]
		return [permissions.AllowAny()]

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)

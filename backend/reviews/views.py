from rest_framework import generics, permissions, status
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminRole
from common.permissions import IsCustomerRole
from analytics.services import track_analytics_event
from orders.models import Order, OrderItem
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
		review = serializer.save(user=self.request.user)
		track_analytics_event(
			event_name="review_submitted",
			source="backend",
			request=self.request,
			user=self.request.user,
			metadata={
				"review_id": review.id,
				"product_id": review.product_id,
				"rating": review.rating,
			},
		)


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


class ReviewEligibilityAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request):
		product_param = request.query_params.get("product", "").strip()
		if not product_param:
			return Response(
				{"detail": "Product query parameter is required."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		try:
			product_id = int(product_param)
		except (TypeError, ValueError):
			return Response(
				{"detail": "Product must be a valid integer ID."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if product_id <= 0:
			return Response(
				{"detail": "Product must be a positive integer ID."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		can_review = OrderItem.objects.filter(
			product_id=product_id,
			order__user=request.user,
			order__status=Order.Status.DELIVERED,
		).exists()

		return Response({"can_review": can_review}, status=status.HTTP_200_OK)


class AdminReviewModerationViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = Review.objects.select_related("user", "product").all().order_by("-created_at")
	serializer_class = AdminReviewSerializer
	http_method_names = ["get", "patch", "delete", "head", "options"]

from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from rest_framework import permissions, viewsets

from common.permissions import IsAdminRole
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryViewSet(viewsets.ModelViewSet):
	queryset = Category.objects.all()
	serializer_class = CategorySerializer
	search_fields = ["name", "slug"]
	ordering_fields = ["name", "created_at"]

	def get_permissions(self):
		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]


class ProductViewSet(viewsets.ModelViewSet):
	queryset = Product.objects.select_related("category").all()
	serializer_class = ProductSerializer
	search_fields = ["name", "description", "category__name"]
	filterset_fields = ["category", "is_active"]
	ordering_fields = ["price", "created_at", "name"]

	def get_queryset(self):
		queryset = super().get_queryset()
		top_selling = self.request.query_params.get("top_selling")
		min_price = self.request.query_params.get("min_price")
		max_price = self.request.query_params.get("max_price")

		if str(top_selling).lower() in {"1", "true", "yes"}:
			queryset = (
				queryset.annotate(
					total_sold=Coalesce(
						Sum(
							"order_items__quantity",
							filter=Q(
								order_items__order__status__in=[
									"PAID",
									"PROCESSING",
									"SHIPPED",
									"DELIVERED",
								],
							),
						),
						0,
					),
				)
				.filter(total_sold__gt=0, is_active=True)
				.order_by("-total_sold", "-created_at")
			)
			return queryset

		if min_price:
			queryset = queryset.filter(price__gte=min_price)
		if max_price:
			queryset = queryset.filter(price__lte=max_price)
		return queryset

	def get_permissions(self):
		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]

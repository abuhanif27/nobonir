from django.db.models import Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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
		min_price = self.request.query_params.get("min_price")
		max_price = self.request.query_params.get("max_price")

		if min_price:
			queryset = queryset.filter(price__gte=min_price)
		if max_price:
			queryset = queryset.filter(price__lte=max_price)
		return queryset

	def _top_selling_last_30_days_queryset(self):
		cutoff = timezone.now() - timezone.timedelta(days=30)
		return (
			super()
			.get_queryset()
			.annotate(
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
							order_items__order__created_at__gte=cutoff,
						),
					),
					0,
				),
			)
			.filter(total_sold__gt=0, is_active=True)
			.order_by("-total_sold", "-created_at")
		)

	@action(detail=False, methods=["get"], url_path="top-selling")
	def top_selling(self, request):
		queryset = self._top_selling_last_30_days_queryset()
		page = self.paginate_queryset(queryset)
		if page is not None:
			serializer = self.get_serializer(page, many=True)
			return self.get_paginated_response(serializer.data)

		serializer = self.get_serializer(queryset, many=True)
		return Response(serializer.data)

	def get_permissions(self):
		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]

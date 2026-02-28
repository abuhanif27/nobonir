from django.db.models import F, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions import IsAdminRole
from .models import Category, InventoryMovement, Product
from .serializers import (
	CategorySerializer,
	ProductMediaUploadSerializer,
	ProductSerializer,
	ProductVariantSerializer,
	StockNotifySerializer,
)
from .services import subscribe_back_in_stock


class CategoryViewSet(viewsets.ModelViewSet):
	queryset = Category.objects.all()
	serializer_class = CategorySerializer
	search_fields = ["name", "slug"]
	ordering_fields = ["name", "created_at"]

	def get_permissions(self):
		if self.action in {"upload_media", "create_variant", "inventory_insights"}:
			return [permissions.IsAuthenticated(), IsAdminRole()]

		if self.action == "notify_stock":
			return [permissions.AllowAny()]

		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]


class ProductViewSet(viewsets.ModelViewSet):
	queryset = Product.objects.select_related("category").prefetch_related("media", "variants__media").all()
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

		availability_status = (self.request.query_params.get("availability_status") or "").strip().upper()
		if availability_status == "OUT_OF_STOCK":
			queryset = queryset.filter(stock=0)
		elif availability_status == "ALMOST_GONE":
			queryset = queryset.filter(stock__gt=0, stock__lte=5)
		elif availability_status == "IN_STOCK":
			queryset = queryset.filter(stock__gt=0)
		elif availability_status == "JUST_RESTOCKED":
			queryset = queryset.filter(
				stock__gt=0,
				last_restocked_at__gte=timezone.now() - timezone.timedelta(days=7),
			)
		elif availability_status == "BACK_IN_STOCK":
			queryset = queryset.filter(
				stock__gt=0,
				last_out_of_stock_at__isnull=False,
				last_restocked_at__gt=F("last_out_of_stock_at"),
			)
		return queryset

	def _top_selling_last_30_days_queryset(self):
		cutoff = timezone.now() - timezone.timedelta(days=30)
		return (
			super()
			.get_queryset()
			.annotate(
				total_sold_30d=Coalesce(
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
			.filter(is_active=True)
			.order_by("-total_sold_30d", "-created_at")
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

	@action(detail=False, methods=["get"], url_path="merchandising")
	def merchandising(self, request):
		base = super().get_queryset().filter(is_active=True)
		now = timezone.now()

		trending = self._top_selling_last_30_days_queryset().filter(total_sold_30d__gt=0)[:12]
		almost_gone = base.filter(stock__gt=0, stock__lte=5).order_by("stock", "-updated_at")[:12]
		just_restocked = base.filter(stock__gt=0, last_restocked_at__gte=now - timezone.timedelta(days=7)).order_by("-last_restocked_at")[:12]
		back_in_stock = base.filter(
			stock__gt=0,
			last_out_of_stock_at__isnull=False,
			last_restocked_at__gt=F("last_out_of_stock_at"),
		).order_by("-last_restocked_at")[:12]

		return Response(
			{
				"trending_now": ProductSerializer(trending, many=True, context={"request": request}).data,
				"almost_gone": ProductSerializer(almost_gone, many=True, context={"request": request}).data,
				"just_restocked": ProductSerializer(just_restocked, many=True, context={"request": request}).data,
				"back_in_stock": ProductSerializer(back_in_stock, many=True, context={"request": request}).data,
			}
		)

	@action(detail=True, methods=["post"], url_path="notify-stock")
	def notify_stock(self, request, pk=None):
		product = self.get_object()
		serializer = StockNotifySerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		subscription = subscribe_back_in_stock(
			product=product,
			channel=serializer.validated_data["channel"],
			contact_value=serializer.validated_data["contact_value"],
			user=request.user if request.user.is_authenticated else None,
		)

		return Response(
			{
				"id": subscription.id,
				"product_id": product.id,
				"channel": subscription.channel,
				"contact_value": subscription.contact_value,
				"is_active": subscription.is_active,
			}
		)

	@action(detail=True, methods=["post"], url_path="media", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def upload_media(self, request, pk=None):
		product = self.get_object()
		serializer = ProductMediaUploadSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		media = serializer.save(product=product)
		return Response(ProductMediaUploadSerializer(media).data)

	@action(detail=True, methods=["post"], url_path="variants", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def create_variant(self, request, pk=None):
		product = self.get_object()
		serializer = ProductVariantSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		variant = serializer.save(product=product)
		return Response(ProductVariantSerializer(variant).data)

	@action(detail=False, methods=["get"], url_path="admin/inventory-insights", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def inventory_insights(self, request):
		cutoff = timezone.now() - timezone.timedelta(days=30)
		queryset = (
			super()
			.get_queryset()
			.annotate(
				total_sold_30d=Coalesce(
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
				)
			)
		)

		items = []
		now = timezone.now()
		for product in queryset:
			sold_30d = int(product.total_sold_30d or 0)
			stock = int(product.stock or 0)
			sell_through_rate = round((sold_30d / max(sold_30d + stock, 1)) * 100, 2)
			daily_sales = sold_30d / 30 if sold_30d > 0 else 0
			days_inventory_left = round(stock / daily_sales, 2) if daily_sales > 0 else None

			last_movement = product.last_stock_movement_at or product.created_at
			stock_age_days = max((now - last_movement).days, 0)

			items.append(
				{
					"product_id": product.id,
					"name": product.name,
					"stock": stock,
					"total_sold_30d": sold_30d,
					"sell_through_rate": sell_through_rate,
					"days_inventory_left": days_inventory_left,
					"stock_age_days": stock_age_days,
				}
			)

		return Response({"items": items, "generated_at": now.isoformat()})

	def get_permissions(self):
		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]

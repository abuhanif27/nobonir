















































import json
from collections import Counter
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from analytics.models import AnalyticsEvent
from common.permissions import IsAdminRole
from .models import Category, InventoryMovement, Product, ProductMedia, ProductVariant
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
	queryset = Product.objects.select_related("category").all()
	serializer_class = ProductSerializer
	search_fields = ["name", "description", "category__name"]
	filterset_fields = ["category", "is_active"]
	ordering_fields = ["price", "created_at", "name"]

	def get_permissions(self):
		admin_actions = {
			"upload_media",
			"create_variant",
			"variant_detail",
			"media_detail",
			"inventory_insights",
			"performance_insights",
			"session_insights",
			"variant_inventory_insights",
		}

		if self.action in admin_actions:
			return [permissions.IsAuthenticated(), IsAdminRole()]

		if self.action == "notify_stock":
			return [permissions.AllowAny()]

		if self.request.method in permissions.SAFE_METHODS:
			return [permissions.AllowAny()]
		return [permissions.IsAuthenticated(), IsAdminRole()]

	def _with_available_stock(self, queryset):
		now = timezone.now()
		return queryset.annotate(
			reserved_stock=Coalesce(
				Sum(
					"stock_reservations__quantity",
					filter=Q(
						stock_reservations__status="ACTIVE",
						stock_reservations__expires_at__gte=now,
					),
				),
				Value(0),
			),
		).annotate(
			available_stock=ExpressionWrapper(
				F("stock") - F("reserved_stock"),
				output_field=IntegerField(),
			)
		)

	def _parse_product_id(self, value):
		if value in (None, ""):
			return None

		try:
			return int(value)
		except (TypeError, ValueError):
			return None

	def _build_event_count_map(self, event_name, cutoff):
		"""Build {product_id: count} map from analytics events.

		Uses JSON field lookup on PostgreSQL; falls back to Python-side
		parsing on SQLite where metadata__product_id lookups are unsupported.
		"""
		qs = AnalyticsEvent.objects.filter(
			created_at__gte=cutoff, event_name=event_name
		)

		try:
			rows = qs.values("metadata__product_id").annotate(count=Count("id"))
			result = {}
			for row in rows:
				pid = self._parse_product_id(row.get("metadata__product_id"))
				if pid is not None:
					result[pid] = int(row.get("count") or 0)
			return result
		except Exception:
			pass

		# Fallback: iterate events and parse metadata in Python
		result: dict[int, int] = Counter()
		for event in qs.only("metadata").iterator():
			meta = event.metadata
			if isinstance(meta, str):
				try:
					meta = json.loads(meta)
				except (json.JSONDecodeError, TypeError):
					continue
			if not isinstance(meta, dict):
				continue
			pid = self._parse_product_id(meta.get("product_id"))
			if pid is not None:
				result[pid] += 1
		return dict(result)

	def _build_session_event_map(self, event_name, cutoff):
		"""Build {product_id: {events, sessions}} map from analytics events.

		Falls back to Python-side parsing on SQLite.
		"""
		qs = AnalyticsEvent.objects.filter(
			created_at__gte=cutoff, event_name=event_name
		).exclude(session_key="")

		try:
			rows = qs.values("metadata__product_id").annotate(
				event_count=Count("id"),
				session_count=Count("session_key", distinct=True),
			)
			result = {}
			for row in rows:
				pid = self._parse_product_id(row.get("metadata__product_id"))
				if pid is not None:
					result[pid] = {
						"events": int(row.get("event_count") or 0),
						"sessions": int(row.get("session_count") or 0),
					}
			return result
		except Exception:
			pass

		# Fallback: iterate and aggregate in Python
		events_counter: dict[int, int] = Counter()
		sessions_map: dict[int, set] = {}
		for event in qs.only("metadata", "session_key").iterator():
			meta = event.metadata
			if isinstance(meta, str):
				try:
					meta = json.loads(meta)
				except (json.JSONDecodeError, TypeError):
					continue
			if not isinstance(meta, dict):
				continue
			pid = self._parse_product_id(meta.get("product_id"))
			if pid is None:
				continue
			events_counter[pid] += 1
			if pid not in sessions_map:
				sessions_map[pid] = set()
			sessions_map[pid].add(event.session_key)

		result = {}
		for pid in set(events_counter) | set(sessions_map):
			result[pid] = {
				"events": events_counter.get(pid, 0),
				"sessions": len(sessions_map.get(pid, set())),
			}
		return result

	def get_queryset(self):
		queryset = self._with_available_stock(super().get_queryset())
		if self.action in {"retrieve", "list", "top_selling", "merchandising"}:
			queryset = queryset.prefetch_related("media", "variants__media")
		queryset = queryset.order_by("-created_at")
		min_price = self.request.query_params.get("min_price")
		max_price = self.request.query_params.get("max_price")

		if min_price:
			queryset = queryset.filter(price__gte=min_price)
		if max_price:
			queryset = queryset.filter(price__lte=max_price)

		availability_status = (self.request.query_params.get("availability_status") or "").strip().upper()
		if availability_status == "OUT_OF_STOCK":
			queryset = queryset.filter(available_stock__lte=0)
		elif availability_status == "ALMOST_GONE":
			queryset = queryset.filter(available_stock__gt=0, available_stock__lte=5)
		elif availability_status == "IN_STOCK":
			queryset = queryset.filter(available_stock__gt=0)
		elif availability_status == "JUST_RESTOCKED":
			queryset = queryset.filter(
				available_stock__gt=0,
				last_restocked_at__gte=timezone.now() - timezone.timedelta(days=7),
			)
		elif availability_status == "BACK_IN_STOCK":
			queryset = queryset.filter(
				available_stock__gt=0,
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
		base = self._with_available_stock(super().get_queryset().filter(is_active=True))
		now = timezone.now()
		used_ids: set[int] = set()
		SECTION_LIMIT = 8

		def take(queryset, bucket, claim=True):
			for product in queryset:
				if product.id in used_ids:
					continue
				bucket.append(product)
				if claim:
					used_ids.add(product.id)
				if len(bucket) >= SECTION_LIMIT:
					break

		# Trending: single most-bought product in the last 24 hours.
		# Counts any placed order (including PENDING) so the section reflects
		# current buying intent; cancelled orders are excluded. Leaves the
		# section empty when nothing was ordered in the last 24h.
		trending: list = []
		cutoff_24h = now - timezone.timedelta(hours=24)
		trending_qs = (
			super()
			.get_queryset()
			.filter(is_active=True)
			.annotate(
				total_sold_24h=Coalesce(
					Sum(
						"order_items__quantity",
						filter=Q(
							order_items__order__status__in=[
								"PENDING",
								"PAID",
								"PROCESSING",
								"SHIPPED",
								"DELIVERED",
							],
							order_items__order__created_at__gte=cutoff_24h,
						),
					),
					0,
				),
			)
			.filter(total_sold_24h__gt=0)
			.order_by("-total_sold_24h", "-updated_at")[:1]
		)
		for product in trending_qs:
			trending.append(product)
			used_ids.add(product.id)

		# Almost Gone: stock 1-5 first, then the lowest-stock in-stock items overall.
		almost_gone: list = []
		take(
			base.filter(available_stock__gt=0, available_stock__lte=5)
			.order_by("available_stock", "-updated_at")[:24],
			almost_gone,
		)
		if not almost_gone:
			take(
				base.filter(available_stock__gt=0)
				.order_by("available_stock", "-updated_at")[:24],
				almost_gone,
			)

		# Just Restocked: last_restocked_at in last 14 days; fall back to most recently updated.
		just_restocked: list = []
		take(
			base.filter(
				available_stock__gt=0,
				last_restocked_at__gte=now - timezone.timedelta(days=14),
			).order_by("-last_restocked_at")[:24],
			just_restocked,
		)
		if not just_restocked:
			take(
				base.filter(available_stock__gt=0).order_by("-updated_at", "-created_at")[:24],
				just_restocked,
			)

		# Back in Stock: products that went out and came back; fall back to well-stocked items.
		back_in_stock: list = []
		take(
			base.filter(
				available_stock__gt=0,
				last_out_of_stock_at__isnull=False,
				last_restocked_at__gt=F("last_out_of_stock_at"),
			).order_by("-last_restocked_at")[:24],
			back_in_stock,
		)
		if not back_in_stock:
			take(
				base.filter(available_stock__gt=5).order_by("-available_stock", "-created_at")[:24],
				back_in_stock,
			)

		# Guarantee at least one item for the stock-based sections even if the
		# catalog is tiny. Trending is intentionally excluded: it must reflect
		# real 24h purchase activity and stay empty otherwise.
		fallback_pool = list(
			base.filter(available_stock__gt=0).order_by("-created_at")[:SECTION_LIMIT]
		)
		if fallback_pool:
			for bucket in (almost_gone, just_restocked, back_in_stock):
				if not bucket:
					bucket.append(fallback_pool[0])

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
		variant = serializer.validated_data.get("variant")
		if variant and variant.product_id != product.id:
			return Response(
				{"detail": "Variant must belong to this product."},
				status=status.HTTP_400_BAD_REQUEST,
			)
		media = serializer.save(product=product)
		self._enforce_primary_media(media)
		return Response(ProductMediaUploadSerializer(media).data)

	@action(detail=True, methods=["post"], url_path="variants", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def create_variant(self, request, pk=None):
		product = self.get_object()
		serializer = ProductVariantSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		variant = serializer.save(product=product)
		return Response(ProductVariantSerializer(variant).data)

	@action(
		detail=True,
		methods=["patch", "delete"],
		url_path=r"variants/(?P<variant_id>[^/.]+)",
		permission_classes=[permissions.IsAuthenticated, IsAdminRole],
	)
	def variant_detail(self, request, pk=None, variant_id=None):
		product = self.get_object()
		variant = get_object_or_404(ProductVariant, pk=variant_id, product=product)

		if request.method == "DELETE":
			variant.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)

		serializer = ProductVariantSerializer(variant, data=request.data, partial=True)
		serializer.is_valid(raise_exception=True)
		updated_variant = serializer.save()
		return Response(ProductVariantSerializer(updated_variant).data)

	@action(
		detail=True,
		methods=["patch", "delete"],
		url_path=r"media/(?P<media_id>[^/.]+)",
		permission_classes=[permissions.IsAuthenticated, IsAdminRole],
	)
	def media_detail(self, request, pk=None, media_id=None):
		product = self.get_object()
		media = get_object_or_404(ProductMedia, pk=media_id, product=product)

		if request.method == "DELETE":
			media.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)

		serializer = ProductMediaUploadSerializer(media, data=request.data, partial=True)
		serializer.is_valid(raise_exception=True)
		variant = serializer.validated_data.get("variant")
		if variant and variant.product_id != product.id:
			return Response(
				{"detail": "Variant must belong to this product."},
				status=status.HTTP_400_BAD_REQUEST,
			)
		updated_media = serializer.save()
		self._enforce_primary_media(updated_media)
		return Response(ProductMediaUploadSerializer(updated_media).data)

	def _enforce_primary_media(self, media: ProductMedia):
		if not media.is_primary:
			return

		scope = ProductMedia.objects.filter(product=media.product, variant=media.variant)
		scope.exclude(id=media.id).update(is_primary=False)

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

	@action(detail=False, methods=["get"], url_path="admin/performance-insights", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def performance_insights(self, request):
		now = timezone.now()
		cutoff = now - timezone.timedelta(days=30)

		sales_queryset = (
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
				total_revenue_30d=Coalesce(
					Sum(
						ExpressionWrapper(
							F("order_items__quantity") * F("order_items__unit_price"),
							output_field=DecimalField(max_digits=14, decimal_places=2),
						),
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
					Value(Decimal("0")),
					output_field=DecimalField(max_digits=14, decimal_places=2),
				),
			)
		)

		view_map = self._build_event_count_map("view_product", cutoff)
		add_to_cart_map = self._build_event_count_map("add_to_cart", cutoff)

		items = []
		for product in sales_queryset:
			product_id = int(product.id)
			view_count = view_map.get(product_id, 0)
			add_count = add_to_cart_map.get(product_id, 0)
			sold_count = int(product.total_sold_30d or 0)
			conversion_pct = round((sold_count / view_count) * 100, 2) if view_count > 0 else None
			add_to_cart_pct = round((add_count / view_count) * 100, 2) if view_count > 0 else None

			items.append(
				{
					"product_id": product_id,
					"name": product.name,
					"stock": int(product.stock or 0),
					"is_active": bool(product.is_active),
					"total_sold_30d": sold_count,
					"total_revenue_30d": str(product.total_revenue_30d or 0),
					"product_views_30d": view_count,
					"add_to_cart_30d": add_count,
					"view_to_add_to_cart_pct": add_to_cart_pct,
					"view_to_purchase_pct": conversion_pct,
				}
			)

		items.sort(key=lambda item: (item["total_sold_30d"], item["product_views_30d"]), reverse=True)

		return Response({"items": items, "generated_at": now.isoformat()})

	@action(detail=False, methods=["get"], url_path="admin/session-insights", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def session_insights(self, request):
		try:
			days = int(request.query_params.get("days", 30))
		except (TypeError, ValueError):
			return Response({"detail": "days must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

		if days <= 0 or days > 90:
			return Response({"detail": "days must be between 1 and 90."}, status=status.HTTP_400_BAD_REQUEST)

		now = timezone.now()
		cutoff = now - timezone.timedelta(days=days)

		raw_view_map = self._build_session_event_map("view_product", cutoff)
		raw_cart_map = self._build_session_event_map("add_to_cart", cutoff)

		view_map = {}
		for pid, info in raw_view_map.items():
			view_map[pid] = {
				"view_events": info["events"],
				"view_sessions": info["sessions"],
			}

		cart_map = {}
		for pid, info in raw_cart_map.items():
			cart_map[pid] = {
				"add_to_cart_events": info["events"],
				"add_to_cart_sessions": info["sessions"],
			}

		products = Product.objects.filter(id__in=set(view_map.keys()) | set(cart_map.keys())).only("id", "name")
		name_map = {int(product.id): product.name for product in products}

		items = []
		for product_id in set(view_map.keys()) | set(cart_map.keys()):
			view_info = view_map.get(product_id, {"view_events": 0, "view_sessions": 0})
			cart_info = cart_map.get(
				product_id,
				{"add_to_cart_events": 0, "add_to_cart_sessions": 0},
			)

			view_sessions = int(view_info["view_sessions"])
			add_sessions = int(cart_info["add_to_cart_sessions"])
			items.append(
				{
					"product_id": product_id,
					"name": name_map.get(product_id, f"Product #{product_id}"),
					"view_events": int(view_info["view_events"]),
					"add_to_cart_events": int(cart_info["add_to_cart_events"]),
					"view_sessions": view_sessions,
					"add_to_cart_sessions": add_sessions,
					"session_to_cart_pct": round((add_sessions / view_sessions) * 100, 2)
					if view_sessions > 0
					else None,
				}
			)

		items.sort(key=lambda item: (item["view_sessions"], item["add_to_cart_sessions"]), reverse=True)
		return Response(
			{
				"window_days": days,
				"items": items,
				"generated_at": now.isoformat(),
			}
		)

	@action(detail=False, methods=["get"], url_path="admin/variant-inventory-insights", permission_classes=[permissions.IsAuthenticated, IsAdminRole])
	def variant_inventory_insights(self, request):
		now = timezone.now()
		queryset = Product.objects.prefetch_related("variants").order_by("name")

		items = []
		for product in queryset:
			active_variants = [variant for variant in product.variants.all() if variant.is_active]
			variant_count = len(active_variants)
			defined_stock = [
				int(variant.stock_override)
				for variant in active_variants
				if variant.stock_override is not None
			]
			defined_count = len(defined_stock)
			undefined_count = max(variant_count - defined_count, 0)
			total_variant_stock = sum(defined_stock)

			if variant_count == 0:
				status_label = "NO_VARIANTS"
			elif undefined_count > 0:
				status_label = "INCOMPLETE"
			elif total_variant_stock != int(product.stock or 0):
				status_label = "MISMATCH"
			else:
				status_label = "OK"

			items.append(
				{
					"product_id": int(product.id),
					"name": product.name,
					"product_stock": int(product.stock or 0),
					"active_variant_count": variant_count,
					"defined_variant_stock_count": defined_count,
					"undefined_variant_stock_count": undefined_count,
					"total_variant_stock": total_variant_stock,
					"variant_stock_coverage_pct": round((defined_count / variant_count) * 100, 2)
					if variant_count > 0
					else None,
					"status": status_label,
				}
			)

		items.sort(
			key=lambda item: (
				item["status"] != "MISMATCH",
				item["status"] != "INCOMPLETE",
				-item["undefined_variant_stock_count"],
			),
		)

		return Response({"items": items, "generated_at": now.isoformat()})

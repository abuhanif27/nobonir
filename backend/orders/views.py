from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.utils.dateparse import parse_date

from common.permissions import IsAdminRole, IsCustomerRole
from .models import Order
from .serializers import AdminOrderSerializer, CheckoutSerializer, CouponValidateSerializer, OrderSerializer
from .services import create_order_from_cart, get_coupon_preview


class CheckoutAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = CheckoutSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			order = create_order_from_cart(
				request.user,
				serializer.validated_data["shipping_address"],
				serializer.validated_data.get("billing_address", ""),
				serializer.validated_data.get("coupon_code", ""),
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CouponValidateAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = CouponValidateSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			preview = get_coupon_preview(request.user, serializer.validated_data["coupon_code"])
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(preview, status=status.HTTP_200_OK)


class MyOrderListAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request):
		queryset = (
			Order.objects.filter(user=request.user)
			.prefetch_related("items")
			.order_by("-created_at")
		)
		return Response(OrderSerializer(queryset, many=True).data)


class AdminOrderViewSet(viewsets.ModelViewSet):
	permission_classes = [permissions.IsAuthenticated, IsAdminRole]
	queryset = Order.objects.select_related("user").prefetch_related("items").all()
	serializer_class = AdminOrderSerializer
	http_method_names = ["get", "patch", "head", "options"]

	def get_queryset(self):
		queryset = self.queryset.order_by("-created_at")
		status_filter = self.request.query_params.get("status", "").strip().upper()
		date_from = self.request.query_params.get("date_from", "").strip()
		date_to = self.request.query_params.get("date_to", "").strip()
		search = self.request.query_params.get("search", "").strip()

		if status_filter and status_filter != "ALL":
			queryset = queryset.filter(status=status_filter)

		parsed_from = parse_date(date_from) if date_from else None
		if parsed_from:
			queryset = queryset.filter(created_at__date__gte=parsed_from)

		parsed_to = parse_date(date_to) if date_to else None
		if parsed_to:
			queryset = queryset.filter(created_at__date__lte=parsed_to)

		if search:
			search_query = (
				Q(user__email__icontains=search)
				| Q(user__first_name__icontains=search)
				| Q(user__last_name__icontains=search)
			)
			if search.isdigit():
				search_query = search_query | Q(id=int(search))
			queryset = queryset.filter(search_query)

		return queryset

	def partial_update(self, request, *args, **kwargs):
		instance = self.get_object()
		next_status = request.data.get("status")
		valid_statuses = {item[0] for item in Order.Status.choices}
		if next_status not in valid_statuses:
			return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
		instance.status = next_status
		instance.save(update_fields=["status", "updated_at"])
		return Response(self.get_serializer(instance).data)

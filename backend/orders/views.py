from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsAdminRole, IsCustomerRole
from .models import Order
from .serializers import CheckoutSerializer, OrderSerializer
from .services import create_order_from_cart


class CheckoutAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = CheckoutSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		try:
			order = create_order_from_cart(request.user, serializer.validated_data["shipping_address"])
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


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
	serializer_class = OrderSerializer
	http_method_names = ["get", "patch", "head", "options"]

	def partial_update(self, request, *args, **kwargs):
		instance = self.get_object()
		next_status = request.data.get("status")
		valid_statuses = {item[0] for item in Order.Status.choices}
		if next_status not in valid_statuses:
			return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
		instance.status = next_status
		instance.save(update_fields=["status", "updated_at"])
		return Response(self.get_serializer(instance).data)

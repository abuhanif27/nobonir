from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCustomerRole
from orders.models import Order
from .serializers import PaymentSerializer, PaymentSimulationSerializer
from .services import process_payment


class PaymentSimulationAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def post(self, request):
		serializer = PaymentSimulationSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		order = get_object_or_404(Order, pk=serializer.validated_data["order_id"], user=request.user)
		try:
			payment = process_payment(
				order=order,
				method=serializer.validated_data["method"],
				success=serializer.validated_data["success"],
			)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
		return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

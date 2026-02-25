from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsCustomerRole
from products.models import Product
from .models import Cart, CartItem, WishlistItem
from .serializers import CartItemSerializer, WishlistItemSerializer
from .utils import get_or_create_cart_for_request


class CartOverviewAPIView(APIView):
	permission_classes = [permissions.AllowAny]

	def get(self, request):
		cart, _ = get_or_create_cart_for_request(request)
		items = CartItem.objects.filter(cart=cart).select_related("product", "product__category")
		return Response(CartItemSerializer(items, many=True).data)


class CartItemAPIView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		cart, _ = get_or_create_cart_for_request(request)
		serializer = CartItemSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		product = get_object_or_404(Product, pk=serializer.validated_data["product_id"], is_active=True)
		item, created = CartItem.objects.get_or_create(
			cart=cart,
			product=product,
			defaults={"quantity": serializer.validated_data["quantity"]},
		)
		if not created:
			item.quantity += serializer.validated_data["quantity"]
			item.save(update_fields=["quantity", "updated_at"])
		return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)

	def patch(self, request, item_id):
		cart, _ = get_or_create_cart_for_request(request)
		item = get_object_or_404(CartItem, cart=cart, pk=item_id)
		quantity = int(request.data.get("quantity", item.quantity))
		if quantity <= 0:
			item.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)
		item.quantity = quantity
		item.save(update_fields=["quantity", "updated_at"])
		return Response(CartItemSerializer(item).data)

	def delete(self, request, item_id):
		cart, _ = get_or_create_cart_for_request(request)
		item = get_object_or_404(CartItem, cart=cart, pk=item_id)
		item.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistOverviewAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def get(self, request):
		items = WishlistItem.objects.filter(user=request.user).select_related("product", "product__category")
		return Response(WishlistItemSerializer(items, many=True).data)

	def post(self, request):
		serializer = WishlistItemSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		product = get_object_or_404(Product, pk=serializer.validated_data["product_id"], is_active=True)
		item, _ = WishlistItem.objects.get_or_create(user=request.user, product=product)
		return Response(WishlistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class WishlistItemAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated, IsCustomerRole]

	def delete(self, request, item_id):
		item = get_object_or_404(WishlistItem, user=request.user, pk=item_id)
		item.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

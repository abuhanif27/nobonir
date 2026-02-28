from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.permissions import IsCustomerRole
from products.models import Product, ProductVariant
from products.services import reserve_stock
from .models import Cart, CartItem, WishlistItem
from .serializers import CartItemQuantitySerializer, CartItemSerializer, WishlistItemSerializer
from .utils import get_or_create_cart_for_request


class CartOverviewAPIView(APIView):
	permission_classes = [permissions.AllowAny]

	def get(self, request):
		cart, _ = get_or_create_cart_for_request(request)
		items = CartItem.objects.filter(cart=cart).select_related("product", "product__category", "variant")
		return Response(CartItemSerializer(items, many=True).data)


class CartItemAPIView(APIView):
	permission_classes = [permissions.AllowAny]
	throttle_classes = [ScopedRateThrottle]

	def get_throttles(self):
		if self.request.method in {"POST", "PATCH", "DELETE"}:
			self.throttle_scope = "cart_write"
			return super().get_throttles()
		return []

	def post(self, request):
		cart, _ = get_or_create_cart_for_request(request)
		serializer = CartItemSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		product = get_object_or_404(Product, pk=serializer.validated_data["product_id"], is_active=True)
		variant_id = serializer.validated_data.get("variant_id")
		variant = None
		if variant_id is not None:
			variant = get_object_or_404(ProductVariant, pk=variant_id, product=product, is_active=True)
		quantity_to_add = serializer.validated_data["quantity"]
		item, created = CartItem.objects.get_or_create(
			cart=cart,
			product=product,
			variant=variant,
			defaults={"quantity": quantity_to_add},
		)
		if not created:
			item.quantity += quantity_to_add
			item.save(update_fields=["quantity", "updated_at"])

		try:
			reserve_stock(cart=cart, product=product, variant=variant, quantity=item.quantity)
		except ValueError as exc:
			if created:
				item.delete()
			else:
				item.quantity -= quantity_to_add
				if item.quantity <= 0:
					item.delete()
				else:
					item.save(update_fields=["quantity", "updated_at"])
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)

	def patch(self, request, item_id):
		cart, _ = get_or_create_cart_for_request(request)
		item = get_object_or_404(CartItem, cart=cart, pk=item_id)
		serializer = CartItemQuantitySerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		quantity = serializer.validated_data["quantity"]
		if quantity <= 0:
			reserve_stock(cart=cart, product=item.product, variant=item.variant, quantity=0)
			item.delete()
			return Response(status=status.HTTP_204_NO_CONTENT)

		try:
			reserve_stock(cart=cart, product=item.product, variant=item.variant, quantity=quantity)
		except ValueError as exc:
			return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

		item.quantity = quantity
		item.save(update_fields=["quantity", "updated_at"])
		return Response(CartItemSerializer(item).data)

	def delete(self, request, item_id):
		cart, _ = get_or_create_cart_for_request(request)
		item = get_object_or_404(CartItem, cart=cart, pk=item_id)
		reserve_stock(cart=cart, product=item.product, variant=item.variant, quantity=0)
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

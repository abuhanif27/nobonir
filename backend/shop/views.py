from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai import recommend_products
from .models import CartItem, Category, Order, OrderItem, Product, Review, WishlistItem
from .serializers import (
	CartItemSerializer,
	CategorySerializer,
	OrderSerializer,
	ProductSerializer,
	ReviewSerializer,
	WishlistSerializer,
)


@api_view(['GET'])
def health(request):
	return Response({'status': 'ok'})


class CategoryListAPIView(APIView):
	def get(self, request):
		serializer = CategorySerializer(Category.objects.all(), many=True)
		return Response(serializer.data)


class ProductListAPIView(APIView):
	def get(self, request):
		queryset = Product.objects.filter(is_active=True).select_related('category').prefetch_related('reviews')

		search = request.query_params.get('search')
		category = request.query_params.get('category')
		min_price = request.query_params.get('min_price')
		max_price = request.query_params.get('max_price')
		in_stock = request.query_params.get('in_stock')
		sort = request.query_params.get('sort', 'newest')

		if search:
			queryset = queryset.filter(
				Q(name__icontains=search)
				| Q(description__icontains=search)
				| Q(category__name__icontains=search)
			)
		if category:
			queryset = queryset.filter(category__slug=category)
		if min_price:
			queryset = queryset.filter(price__gte=min_price)
		if max_price:
			queryset = queryset.filter(price__lte=max_price)
		if in_stock == 'true':
			queryset = queryset.filter(stock__gt=0)

		if sort == 'price_asc':
			queryset = queryset.order_by('price')
		elif sort == 'price_desc':
			queryset = queryset.order_by('-price')
		elif sort == 'name':
			queryset = queryset.order_by('name')
		else:
			queryset = queryset.order_by('-created_at')

		serializer = ProductSerializer(queryset, many=True)
		return Response(serializer.data)


class ProductDetailAPIView(APIView):
	def get(self, request, product_id):
		try:
			product = Product.objects.select_related('category').prefetch_related('reviews').get(id=product_id)
		except Product.DoesNotExist:
			return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

		return Response(ProductSerializer(product).data)


class ProductReviewAPIView(APIView):
	def get(self, request, product_id):
		reviews = Review.objects.filter(product_id=product_id)
		serializer = ReviewSerializer(reviews, many=True)
		return Response(serializer.data)

	def post(self, request, product_id):
		data = request.data.copy()
		data['product'] = product_id
		serializer = ReviewSerializer(data=data)
		if serializer.is_valid():
			serializer.save()
			return Response(serializer.data, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WishlistAPIView(APIView):
	def get(self, request):
		customer_id = request.query_params.get('customer_id')
		if not customer_id:
			return Response({'detail': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)
		queryset = WishlistItem.objects.filter(customer_id=customer_id).select_related('product__category')
		serializer = WishlistSerializer(queryset, many=True)
		return Response(serializer.data)

	def post(self, request):
		serializer = WishlistSerializer(data=request.data)
		if serializer.is_valid():
			customer_id = serializer.validated_data['customer_id']
			product = Product.objects.filter(id=serializer.validated_data['product_id']).first()
			if not product:
				return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
			item, _ = WishlistItem.objects.get_or_create(customer_id=customer_id, product=product)
			return Response(WishlistSerializer(item).data, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WishlistItemAPIView(APIView):
	def delete(self, request, item_id):
		try:
			item = WishlistItem.objects.get(id=item_id)
		except WishlistItem.DoesNotExist:
			return Response(status=status.HTTP_204_NO_CONTENT)
		item.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class CartAPIView(APIView):
	def get(self, request):
		customer_id = request.query_params.get('customer_id')
		if not customer_id:
			return Response({'detail': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)
		queryset = CartItem.objects.filter(customer_id=customer_id).select_related('product__category')
		serializer = CartItemSerializer(queryset, many=True)
		return Response(serializer.data)

	def post(self, request):
		serializer = CartItemSerializer(data=request.data)
		if serializer.is_valid():
			customer_id = serializer.validated_data['customer_id']
			quantity = serializer.validated_data['quantity']
			product = Product.objects.filter(id=serializer.validated_data['product_id']).first()
			if not product:
				return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
			item, created = CartItem.objects.get_or_create(
				customer_id=customer_id,
				product=product,
				defaults={'quantity': quantity},
			)
			if not created:
				item.quantity += quantity
				item.save(update_fields=['quantity', 'updated_at'])
			return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CartItemAPIView(APIView):
	def patch(self, request, item_id):
		try:
			item = CartItem.objects.get(id=item_id)
		except CartItem.DoesNotExist:
			return Response({'detail': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)

		quantity = request.data.get('quantity')
		if not quantity or int(quantity) <= 0:
			return Response({'detail': 'quantity must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)
		item.quantity = int(quantity)
		item.save(update_fields=['quantity', 'updated_at'])
		return Response(CartItemSerializer(item).data)

	def delete(self, request, item_id):
		CartItem.objects.filter(id=item_id).delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class CheckoutAPIView(APIView):
	@transaction.atomic
	def post(self, request):
		customer_id = request.data.get('customer_id')
		customer_name = request.data.get('customer_name')
		customer_email = request.data.get('customer_email')
		shipping_address = request.data.get('shipping_address')

		if not all([customer_id, customer_name, customer_email, shipping_address]):
			return Response({'detail': 'Missing checkout fields'}, status=status.HTTP_400_BAD_REQUEST)

		cart_items = list(CartItem.objects.filter(customer_id=customer_id).select_related('product'))
		if not cart_items:
			return Response({'detail': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

		total_amount = Decimal('0.00')
		for item in cart_items:
			product = item.product
			if product.stock < item.quantity:
				return Response(
					{'detail': f'Insufficient stock for {product.name}'},
					status=status.HTTP_400_BAD_REQUEST,
				)
			price = Decimal(str(product.discounted_price))
			total_amount += price * item.quantity

		order = Order.objects.create(
			customer_name=customer_name,
			customer_email=customer_email,
			shipping_address=shipping_address,
			total_amount=total_amount,
			status=Order.Status.PAID,
		)

		for item in cart_items:
			product = item.product
			OrderItem.objects.create(
				order=order,
				product=product,
				product_name=product.name,
				quantity=item.quantity,
				unit_price=Decimal(str(product.discounted_price)),
			)
			product.stock -= item.quantity
			product.save(update_fields=['stock'])

		CartItem.objects.filter(customer_id=customer_id).delete()
		return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderListAPIView(APIView):
	def get(self, request):
		customer_email = request.query_params.get('customer_email')
		queryset = Order.objects.all().prefetch_related('items')
		if customer_email:
			queryset = queryset.filter(customer_email=customer_email)
		serializer = OrderSerializer(queryset, many=True)
		return Response(serializer.data)


class OrderDetailAPIView(APIView):
	def get(self, request, order_id):
		try:
			order = Order.objects.prefetch_related('items').get(id=order_id)
		except Order.DoesNotExist:
			return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
		return Response(OrderSerializer(order).data)


class RecommendationAPIView(APIView):
	def get(self, request):
		customer_id = request.query_params.get('customer_id')
		if not customer_id:
			return Response({'detail': 'customer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

		recommendations = recommend_products(customer_id)
		serializer = ProductSerializer(recommendations, many=True)
		return Response(serializer.data)

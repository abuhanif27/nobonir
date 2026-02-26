from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from products.serializers import ProductSerializer
from .models import UserPreference
from .serializers import QuerySerializer, SentimentSerializer, UserPreferenceSerializer
from .services.recommendation_service import (
	get_personalized_recommendations_for_user,
	get_recommendations_for_user,
	train_user_preference_model,
)
from .services.search_service import semantic_product_search
from .services.sentiment_service import analyze_sentiment


class RecommendationAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		products = get_personalized_recommendations_for_user(request.user)
		return Response(ProductSerializer(products, many=True).data)


class UserPreferenceAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		return Response(UserPreferenceSerializer(preference).data)

	def put(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		serializer = UserPreferenceSerializer(preference, data=request.data)
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(serializer.data)

	def patch(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		serializer = UserPreferenceSerializer(preference, data=request.data, partial=True)
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(serializer.data)


class PreferenceTrainAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		preference = train_user_preference_model(request.user)
		products = get_personalized_recommendations_for_user(request.user, limit=8)
		return Response({
			"preference": UserPreferenceSerializer(preference).data,
			"recommendations": ProductSerializer(products, many=True).data,
		})


class PersonalizedRecommendationAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		products = get_personalized_recommendations_for_user(request.user)
		return Response(ProductSerializer(products, many=True).data)


class SearchAPIView(APIView):
	permission_classes = [permissions.AllowAny]

	def get(self, request):
		serializer = QuerySerializer(data=request.query_params)
		serializer.is_valid(raise_exception=True)
		limit = request.query_params.get("limit")
		try:
			limit_value = int(limit) if limit is not None else 12
		except (TypeError, ValueError):
			limit_value = 12

		results = semantic_product_search(serializer.validated_data["q"], limit=limit_value)
		return Response(ProductSerializer(results, many=True).data)


class SentimentAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = SentimentSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		return Response(analyze_sentiment(serializer.validated_data["text"]))

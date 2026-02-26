import json
from urllib.error import URLError, HTTPError
from urllib.request import urlopen

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

	def _age_from_birthdate(self, user):
		dob = getattr(user, "date_of_birth", None)
		if not dob:
			return None

		from datetime import date

		today = date.today()
		age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
		return age if age >= 0 else None

	def _payload_with_auto_age(self, request):
		payload = request.data.copy()
		auto_age = self._age_from_birthdate(request.user)
		if auto_age is not None:
			payload["age"] = auto_age
		return payload

	def get(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		return Response(UserPreferenceSerializer(preference).data)

	def put(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		serializer = UserPreferenceSerializer(preference, data=self._payload_with_auto_age(request))
		serializer.is_valid(raise_exception=True)
		serializer.save()
		return Response(serializer.data)

	def patch(self, request):
		preference, _ = UserPreference.objects.get_or_create(user=request.user)
		serializer = UserPreferenceSerializer(preference, data=self._payload_with_auto_age(request), partial=True)
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


class GeoDetectAPIView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def _fetch_json(self, url: str):
		try:
			with urlopen(url, timeout=5) as response:
				if response.status != 200:
					return None
				return json.loads(response.read().decode("utf-8"))
		except (URLError, HTTPError, TimeoutError, ValueError):
			return None

	def get(self, request):
		primary = self._fetch_json("https://ipapi.co/json/")
		if primary and (primary.get("country_name") or primary.get("country_code")):
			continent_map = {
				"AF": "Africa",
				"AN": "Antarctica",
				"AS": "Asia",
				"EU": "Europe",
				"NA": "North America",
				"OC": "Oceania",
				"SA": "South America",
			}
			return Response({
				"country": primary.get("country_name", ""),
				"country_code": primary.get("country_code", ""),
				"continent": continent_map.get(str(primary.get("continent_code", "")).upper(), ""),
				"city": primary.get("city", ""),
				"provider": "ipapi",
			})

		fallback = self._fetch_json("https://ipwho.is/")
		if fallback and fallback.get("success"):
			return Response({
				"country": fallback.get("country", ""),
				"country_code": fallback.get("country_code", ""),
				"continent": fallback.get("continent", ""),
				"city": fallback.get("city", ""),
				"provider": "ipwhois",
			})

		return Response({
			"country": "",
			"country_code": "",
			"continent": "",
			"city": "",
			"provider": "none",
			"detail": "Geo detection unavailable",
		}, status=503)


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

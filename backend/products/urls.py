from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ProductViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("", ProductViewSet, basename="product")

legacy_router = DefaultRouter()
legacy_router.register("products", ProductViewSet, basename="product-legacy")

urlpatterns = router.urls + legacy_router.urls

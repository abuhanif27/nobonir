from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, ProductViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("", ProductViewSet, basename="product")
router.register("products", ProductViewSet, basename="product-legacy")

urlpatterns = router.urls

from rest_framework import serializers

from .models import (
    Category,
    Product,
    ProductMedia,
    ProductVariant,
)
from .services import get_available_stock
from .services import set_product_stock


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all(), write_only=True)
    media = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()
    availability_status = serializers.SerializerMethodField()
    merchandising_tags = serializers.SerializerMethodField()
    total_sold_30d = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "category",
            "category_id",
            "name",
            "slug",
            "description",
            "price",
            "stock",
            "is_active",
            "image_url",
            "primary_image",
            "media",
            "variants",
            "available_stock",
            "availability_status",
            "merchandising_tags",
            "total_sold_30d",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return value

    def update(self, instance, validated_data):
        requested_stock = validated_data.pop("stock", None)
        product = super().update(instance, validated_data)
        if requested_stock is not None:
            set_product_stock(
                product_id=product.id,
                new_stock=int(requested_stock),
                reference_type="ADMIN_PRODUCT_UPDATE",
                reference_id=str(product.id),
            )
            product.refresh_from_db()
        return product

    def get_media(self, obj: Product):
        request = self.context.get("request")
        media_items = obj.media.select_related("variant").all()
        payload = []
        for media in media_items:
            if media.image_file:
                url = request.build_absolute_uri(media.image_file.url) if request else media.image_file.url
            else:
                url = media.image_url
            if not url:
                continue
            payload.append(
                {
                    "id": media.id,
                    "url": url,
                    "alt_text": media.alt_text,
                    "sort_order": media.sort_order,
                    "is_primary": media.is_primary,
                    "variant_id": media.variant_id,
                }
            )
        payload.sort(key=lambda item: (not bool(item.get("is_primary")), item.get("sort_order", 0), item.get("id", 0)))
        return payload

    def get_primary_image(self, obj: Product):
        media_payload = self.get_media(obj)
        if media_payload:
            return media_payload[0].get("url")
        return obj.image_url or ""

    def get_variants(self, obj: Product):
        request = self.context.get("request")
        variants = []
        for variant in obj.variants.prefetch_related("media").all():
            media_urls = []
            for media in variant.media.all():
                if media.image_file:
                    media_urls.append(
                        request.build_absolute_uri(media.image_file.url)
                        if request
                        else media.image_file.url
                    )
                elif media.image_url:
                    media_urls.append(media.image_url)

            variants.append(
                {
                    "id": variant.id,
                    "color": variant.color,
                    "size": variant.size,
                    "sku": variant.sku,
                    "stock": variant.stock_override,
                    "media": media_urls,
                }
            )
        return variants

    def get_available_stock(self, obj: Product):
        try:
            return get_available_stock(obj)
        except Exception:
            return int(obj.stock)

    def get_availability_status(self, obj: Product):
        available_stock = self.get_available_stock(obj)
        if available_stock <= 0:
            return "OUT_OF_STOCK"
        if available_stock <= 5:
            return "ALMOST_GONE"
        return "IN_STOCK"

    def get_merchandising_tags(self, obj: Product):
        tags: list[str] = []
        sold_30d = int(getattr(obj, "total_sold_30d", 0) or 0)
        if sold_30d > 0:
            tags.append("TRENDING_NOW")

        available_stock = self.get_available_stock(obj)
        if 0 < available_stock <= 5:
            tags.append("ALMOST_GONE")
        return self._build_restock_tags(obj, tags)

    def get_total_sold_30d(self, obj: Product):
        return int(getattr(obj, "total_sold_30d", 0) or 0)

    def _build_restock_tags(self, obj: Product, tags: list[str]):
        from django.utils import timezone

        now = timezone.now()
        if obj.last_restocked_at and obj.last_restocked_at >= now - timezone.timedelta(days=7):
            tags.append("JUST_RESTOCKED")

        if (
            obj.last_out_of_stock_at
            and obj.last_restocked_at
            and obj.last_restocked_at > obj.last_out_of_stock_at
            and obj.last_restocked_at >= now - timezone.timedelta(days=30)
        ):
            tags.append("BACK_IN_STOCK")

        return tags


class ProductMediaUploadSerializer(serializers.ModelSerializer):
    variant_id = serializers.PrimaryKeyRelatedField(
        source="variant",
        queryset=ProductVariant.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ProductMedia
        fields = [
            "id",
            "variant_id",
            "image_file",
            "image_url",
            "alt_text",
            "sort_order",
            "is_primary",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        image_file = attrs.get("image_file")
        incoming_image_url = (attrs.get("image_url") or "").strip()

        if incoming_image_url:
            raise serializers.ValidationError(
                {"image_url": "Image URL uploads are deprecated. Upload image_file instead."}
            )

        if not self.instance and not image_file:
            raise serializers.ValidationError({"image_file": "Image file is required."})

        if image_file:
            allowed_types = {"image/jpeg", "image/png", "image/webp"}
            content_type = (getattr(image_file, "content_type", "") or "").lower()
            if content_type and content_type not in allowed_types:
                raise serializers.ValidationError(
                    {"image_file": "Unsupported image type. Use JPG, PNG, or WEBP."}
                )

            max_size = 5 * 1024 * 1024
            if image_file.size > max_size:
                raise serializers.ValidationError(
                    {"image_file": "Image file size must be 5MB or less."}
                )

        return attrs


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "color",
            "size",
            "sku",
            "stock_override",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class StockNotifySerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=["EMAIL", "WHATSAPP"])
    contact_value = serializers.CharField(max_length=180)

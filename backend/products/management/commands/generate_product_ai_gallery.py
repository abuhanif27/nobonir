from __future__ import annotations

from io import BytesIO
from pathlib import Path
from random import randint
from urllib.parse import quote_plus

import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw

from products.models import Product, ProductMedia


class Command(BaseCommand):
    help = "Generate initial AI product gallery images and attach as uploaded media files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--product-id",
            type=int,
            default=None,
            help="Generate gallery only for one product id.",
        )
        parser.add_argument(
            "--per-product",
            type=int,
            default=3,
            help="How many gallery images to generate per product.",
        )
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help="Generate only for products that currently have no media.",
        )

    def handle(self, *args, **options):
        product_id = options.get("product_id")
        per_product = max(int(options.get("per_product") or 3), 1)
        only_missing = bool(options.get("only_missing"))

        queryset = Product.objects.filter(is_active=True).order_by("id")
        if product_id:
            queryset = queryset.filter(id=product_id)
        if only_missing:
            queryset = queryset.filter(media__isnull=True)

        products = list(queryset.distinct())
        if not products:
            self.stdout.write(self.style.WARNING("No products matched the selection."))
            return

        created_count = 0
        for product in products:
            existing_count = product.media.count()
            to_create = max(per_product - existing_count, 0)
            if to_create == 0:
                continue

            for index in range(existing_count, existing_count + to_create):
                prompt = self._build_prompt(product.name, product.description, index + 1)
                image_bytes = self._fetch_ai_image(prompt)
                if image_bytes is None:
                    image_bytes = self._build_fallback_image(prompt)

                media = ProductMedia.objects.create(
                    product=product,
                    alt_text=f"{product.name} gallery image {index + 1}",
                    sort_order=index,
                    is_primary=index == 0,
                )
                filename = self._filename(product.slug, index + 1)
                media.image_file.save(filename, ContentFile(image_bytes), save=True)
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"AI gallery generation completed. Created {created_count} media images."
            )
        )

    def _build_prompt(self, name: str, description: str, index: int) -> str:
        base = f"Professional ecommerce product photo of {name}."
        details = f" {description.strip()}" if description else ""
        angle = f" Variation #{index}, studio lighting, clean background, high detail."
        return f"{base}{details}{angle}".strip()

    def _fetch_ai_image(self, prompt: str) -> bytes | None:
        encoded = quote_plus(prompt)
        seed = randint(1000, 999999)
        url = (
            "https://image.pollinations.ai/prompt/"
            f"{encoded}?model=flux&width=1024&height=1024&nologo=true&seed={seed}"
        )

        try:
            response = requests.get(url, timeout=20)
            response.raise_for_status()
            if not response.content:
                return None
            return response.content
        except Exception:
            return None

    def _build_fallback_image(self, prompt: str) -> bytes:
        image = Image.new("RGB", (1024, 1024), (18, 24, 38))
        draw = ImageDraw.Draw(image)

        accent = (randint(40, 120), randint(90, 170), randint(150, 230))
        draw.rounded_rectangle((90, 90, 934, 934), radius=54, fill=accent)
        draw.rounded_rectangle((170, 170, 854, 854), radius=44, fill=(245, 247, 250))

        preview_text = prompt[:140]
        draw.text((210, 460), "AI Product Preview", fill=(24, 31, 48))
        draw.text((210, 520), preview_text, fill=(24, 31, 48))

        output = BytesIO()
        image.save(output, format="JPEG", quality=90)
        return output.getvalue()

    def _filename(self, slug: str, index: int) -> str:
        safe_slug = Path(slug).name.replace(" ", "-")
        return f"{safe_slug}-ai-{index}.jpg"

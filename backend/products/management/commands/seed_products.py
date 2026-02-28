from __future__ import annotations

from decimal import Decimal
from pathlib import Path
import requests
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from products.models import Category, Product, ProductMedia


CATALOG_BLUEPRINT: dict[str, list[dict[str, str | int]]] = {
    "Electronics": [
        {"name": "Smartphone", "query": "smartphone"},
        {"name": "Wireless Earbuds", "query": "wireless earbuds"},
        {"name": "Smart Watch", "query": "smart watch"},
        {"name": "Bluetooth Speaker", "query": "bluetooth speaker"},
        {"name": "Gaming Keyboard", "query": "gaming keyboard"},
    ],
    "Fashion": [
        {"name": "Running Shoes", "query": "running shoes"},
        {"name": "Denim Jacket", "query": "denim jacket"},
        {"name": "Crossbody Bag", "query": "crossbody bag"},
        {"name": "Cotton T-Shirt", "query": "cotton t-shirt"},
        {"name": "Sunglasses", "query": "fashion sunglasses"},
    ],
    "Home": [
        {"name": "Air Fryer", "query": "air fryer"},
        {"name": "Desk Lamp", "query": "desk lamp"},
        {"name": "Coffee Grinder", "query": "coffee grinder"},
        {"name": "Vacuum Cleaner", "query": "vacuum cleaner"},
        {"name": "Cookware Set", "query": "cookware set"},
    ],
    "Beauty": [
        {"name": "Face Serum", "query": "face serum"},
        {"name": "Moisturizer", "query": "moisturizer"},
        {"name": "Hair Dryer", "query": "hair dryer"},
        {"name": "Perfume", "query": "perfume bottle"},
        {"name": "Makeup Palette", "query": "makeup palette"},
    ],
    "Sports": [
        {"name": "Yoga Mat", "query": "yoga mat"},
        {"name": "Dumbbell Set", "query": "dumbbell set"},
        {"name": "Football", "query": "football ball"},
        {"name": "Cycling Helmet", "query": "cycling helmet"},
        {"name": "Tennis Racket", "query": "tennis racket"},
    ],
    "Books": [
        {"name": "Business Book", "query": "business book"},
        {"name": "Novel Collection", "query": "novel books"},
        {"name": "Cookbook", "query": "cookbook"},
        {"name": "Children Story Book", "query": "children book"},
        {"name": "Productivity Book", "query": "productivity book"},
    ],
    "Toys": [
        {"name": "Building Blocks", "query": "building blocks toy"},
        {"name": "Remote Car", "query": "remote control car toy"},
        {"name": "Plush Bear", "query": "plush teddy bear"},
        {"name": "Puzzle Set", "query": "puzzle game"},
        {"name": "Board Game", "query": "board game"},
    ],
    "Groceries": [
        {"name": "Organic Honey", "query": "organic honey"},
        {"name": "Premium Coffee", "query": "coffee beans"},
        {"name": "Olive Oil", "query": "olive oil bottle"},
        {"name": "Dry Fruits Mix", "query": "dry fruits"},
        {"name": "Granola Pack", "query": "granola"},
    ],
    "Office": [
        {"name": "Office Chair", "query": "office chair"},
        {"name": "Laptop Stand", "query": "laptop stand"},
        {"name": "Notebook Set", "query": "stationery notebook"},
        {"name": "Desk Organizer", "query": "desk organizer"},
        {"name": "Whiteboard", "query": "whiteboard"},
    ],
    "Automotive": [
        {"name": "Car Phone Holder", "query": "car phone holder"},
        {"name": "Dash Camera", "query": "dash camera"},
        {"name": "Car Vacuum", "query": "car vacuum cleaner"},
        {"name": "Seat Cushion", "query": "car seat cushion"},
        {"name": "LED Headlight", "query": "led car headlight"},
    ],
}


class Command(BaseCommand):
    help = "Seed at least 50 products with downloaded web images and gallery files"

    def add_arguments(self, parser):
        parser.add_argument(
            "--total-products",
            type=int,
            default=50,
            help="Minimum total products to create.",
        )
        parser.add_argument(
            "--gallery-size",
            type=int,
            default=3,
            help="How many gallery images to download per product.",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove existing products/categories/media and reseed cleanly.",
        )

    def handle(self, *args, **options):
        total_products = max(int(options.get("total_products") or 50), 50)
        gallery_size = max(int(options.get("gallery_size") or 3), 1)
        clean = bool(options.get("clean"))

        if clean:
            self._clean_existing_catalog()

        catalog_entries = self._build_catalog_entries(total_products)

        created_products = 0
        updated_products = 0
        created_media = 0

        for index, entry in enumerate(catalog_entries):
            category_name = entry["category"]
            category_slug = slugify(category_name)
            category, _ = Category.objects.get_or_create(
                name=category_name,
                slug=category_slug,
            )

            slug = entry["slug"]
            product, was_created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "category": category,
                    "name": entry["name"],
                    "description": entry["description"],
                    "price": Decimal(str(entry["price"])),
                    "stock": int(entry["stock"]),
                    "image_url": "",
                    "is_active": True,
                },
            )

            if was_created:
                created_products += 1
            else:
                updated_products += 1

            product.media.all().delete()
            downloaded = self._attach_gallery_from_web(
                product=product,
                query=str(entry["query"]),
                gallery_size=gallery_size,
                seed_index=index,
            )
            created_media += downloaded

        self.stdout.write(
            self.style.SUCCESS(
                "Seed complete. "
                f"Products created: {created_products}, "
                f"updated: {updated_products}, "
                f"media downloaded: {created_media}."
            )
        )

    def _build_catalog_entries(self, total_products: int) -> list[dict[str, str | int | float]]:
        entries: list[dict[str, str | int | float]] = []
        round_idx = 1
        while len(entries) < total_products:
            for category_name, items in CATALOG_BLUEPRINT.items():
                for item in items:
                    if len(entries) >= total_products:
                        break

                    product_name = f"{item['name']} {round_idx}"
                    slug = slugify(f"{category_name}-{item['name']}-{round_idx}")
                    price = 19 + ((len(entries) * 7) % 300)
                    stock = 10 + ((len(entries) * 13) % 140)
                    description = (
                        f"Premium {item['name'].lower()} for everyday use. "
                        "High quality finish, reliable performance, and modern design."
                    )

                    entries.append(
                        {
                            "category": category_name,
                            "name": product_name,
                            "slug": slug,
                            "query": str(item["query"]),
                            "description": description,
                            "price": float(price),
                            "stock": int(stock),
                        }
                    )
                if len(entries) >= total_products:
                    break
            round_idx += 1
        return entries

    def _attach_gallery_from_web(self, *, product: Product, query: str, gallery_size: int, seed_index: int) -> int:
        downloaded = 0
        base_seed = slugify(f"{product.slug}-{query}")

        for gallery_index in range(gallery_size):
            seed = f"{base_seed}-{seed_index}-{gallery_index + 1}"
            url = f"https://picsum.photos/seed/{seed}/1200/1200"
            image_bytes = self._download_bytes(url)
            if not image_bytes:
                continue

            media = ProductMedia.objects.create(
                product=product,
                alt_text=f"{product.name} gallery image {gallery_index + 1}",
                sort_order=gallery_index,
                is_primary=gallery_index == 0,
            )
            filename = self._build_filename(product.slug, gallery_index + 1)
            media.image_file.save(filename, ContentFile(image_bytes), save=True)
            downloaded += 1
        return downloaded

    def _download_bytes(self, url: str) -> bytes | None:
        try:
            response = requests.get(url, timeout=6)
            response.raise_for_status()
            if not response.content:
                return None
            return response.content
        except Exception:
            return None

    def _build_filename(self, slug: str, index: int) -> str:
        clean_slug = slugify(slug)
        return f"{clean_slug}-gallery-{index}.jpg"

    def _clean_existing_catalog(self):
        image_paths: list[Path] = []
        for media in ProductMedia.objects.exclude(image_file=""):
            try:
                image_paths.append(Path(media.image_file.path))
            except Exception:
                continue

        ProductMedia.objects.all().delete()

        deletable_products = Product.objects.filter(order_items__isnull=True)
        deletable_products.delete()

        Category.objects.filter(products__isnull=True).delete()

        for path in image_paths:
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                continue

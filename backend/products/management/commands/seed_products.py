from django.core.management.base import BaseCommand

from products.models import Category, Product


class Command(BaseCommand):
    help = "Seed categories and products"

    def handle(self, *args, **options):
        data = {
            "Electronics": [
                (
                    "smartphone-x",
                    "Smartphone X",
                    "Triple-camera 5G phone with OLED display",
                    699,
                    42,
                ),
                (
                    "wireless-buds-pro",
                    "Wireless Buds Pro",
                    "ANC earbuds with transparency mode",
                    129,
                    110,
                ),
                (
                    "smart-watch-sport",
                    "Smart Watch Sport",
                    "Fitness tracking smartwatch with GPS",
                    189,
                    36,
                ),
            ],
            "Fashion": [
                (
                    "running-shoes-lite",
                    "Running Shoes Lite",
                    "Breathable lightweight trainers",
                    95,
                    58,
                ),
                (
                    "denim-jacket-classic",
                    "Denim Jacket Classic",
                    "Mid-wash slim-fit jacket",
                    84,
                    24,
                ),
                (
                    "crossbody-bag",
                    "Crossbody Bag",
                    "Water-resistant compact daily bag",
                    49,
                    67,
                ),
            ],
            "Home": [
                (
                    "air-fryer-xl",
                    "Air Fryer XL",
                    "7L digital air fryer with presets",
                    159,
                    19,
                ),
                (
                    "desk-lamp-pro",
                    "Desk Lamp Pro",
                    "Dimmable LED lamp with USB charging",
                    39,
                    73,
                ),
                (
                    "coffee-grinder",
                    "Coffee Grinder",
                    "Burr grinder with 24 grind settings",
                    99,
                    27,
                ),
            ],
        }

        created = 0
        updated = 0
        for category_name, products in data.items():
            category, _ = Category.objects.get_or_create(
                name=category_name,
                slug=category_name.lower(),
            )
            for slug, name, description, price, stock in products:
                product, was_created = Product.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "category": category,
                        "name": name,
                        "description": description,
                        "price": price,
                        "stock": stock,
                        "image_url": "",
                        "is_active": True,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete. Products created: {created}, updated: {updated}"
            )
        )

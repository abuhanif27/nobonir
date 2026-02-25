from django.core.management.base import BaseCommand

from products.models import Category, Product


class Command(BaseCommand):
    help = "Seed categories and products"

    def handle(self, *args, **options):
        data = {
            "Electronics": [
                ("smartphone-x", "Smartphone X", "AI camera phone", 600, 25),
                ("wireless-buds", "Wireless Buds", "Noise cancelling earbuds", 75, 80),
            ],
            "Fashion": [
                ("running-shoes", "Running Shoes", "Light and durable", 90, 35),
                ("denim-jacket", "Denim Jacket", "Classic fit denim", 70, 20),
            ],
            "Home": [
                ("air-fryer", "Air Fryer", "Healthy cooking", 120, 15),
                ("desk-lamp", "Desk Lamp", "Adjustable warm light", 30, 55),
            ],
        }

        created = 0
        for category_name, products in data.items():
            category, _ = Category.objects.get_or_create(name=category_name, slug=category_name.lower())
            for slug, name, description, price, stock in products:
                _, was_created = Product.objects.get_or_create(
                    slug=slug,
                    defaults={
                        "category": category,
                        "name": name,
                        "description": description,
                        "price": price,
                        "stock": stock,
                        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200",
                        "is_active": True,
                    },
                )
                if was_created:
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Seed complete. Products created: {created}"))

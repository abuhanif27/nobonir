from django.core.management.base import BaseCommand

from products.models import Category, Product


class Command(BaseCommand):
    help = "Seed categories and products"

    def handle(self, *args, **options):
        # Product data with proper image URLs
        data = {
            "Electronics": [
                ("smartphone-x", "Smartphone X", "AI camera phone", 600, 25, 
                 "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600"),
                ("wireless-buds", "Wireless Buds", "Noise cancelling earbuds", 75, 80,
                 "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"),
            ],
            "Fashion": [
                ("running-shoes", "Running Shoes", "Light and durable", 90, 35,
                 "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"),
                ("denim-jacket", "Denim Jacket", "Classic fit denim", 70, 20,
                 "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600"),
            ],
            "Home": [
                ("air-fryer", "Air Fryer", "Healthy cooking", 120, 15,
                 "https://images.unsplash.com/photo-1585515320310-259814833e62?w=600"),
                ("desk-lamp", "Desk Lamp", "Adjustable warm light", 30, 55,
                 "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600"),
            ],
        }

        created = 0
        updated = 0
        for category_name, products in data.items():
            category, _ = Category.objects.get_or_create(name=category_name, slug=category_name.lower())
            for slug, name, description, price, stock, image_url in products:
                product, was_created = Product.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "category": category,
                        "name": name,
                        "description": description,
                        "price": price,
                        "stock": stock,
                        "image_url": image_url,
                        "is_active": True,
                    },
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(f"Seed complete. Products created: {created}, updated: {updated}"))

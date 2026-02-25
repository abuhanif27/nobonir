from django.core.management.base import BaseCommand
from django.utils.text import slugify

from shop.models import Category, Product


class Command(BaseCommand):
    help = 'Seed sample categories and products'

    def handle(self, *args, **options):
        catalog = {
            'Electronics': [
                ('Smartphone Pro X', 'High-performance smartphone with AI camera.', 650, 20, 10),
                ('Wireless Earbuds', 'Noise-canceling earbuds for daily use.', 80, 50, 5),
                ('Gaming Laptop', 'Powerful laptop for creators and gamers.', 1400, 12, 15),
            ],
            'Fashion': [
                ('Classic Denim Jacket', 'Comfortable and stylish jacket.', 60, 35, 0),
                ('Running Shoes', 'Lightweight shoes for training.', 75, 40, 8),
                ('Leather Backpack', 'Durable backpack for travel and work.', 95, 18, 12),
            ],
            'Home': [
                ('Air Fryer 5L', 'Fast healthy cooking with minimal oil.', 110, 30, 7),
                ('Smart LED Lamp', 'Adjustable brightness with app control.', 35, 42, 0),
                ('Coffee Maker', 'Automatic coffee machine with timer.', 130, 10, 10),
            ],
        }

        created_count = 0
        for category_name, products in catalog.items():
            category, _ = Category.objects.get_or_create(
                name=category_name,
                defaults={'slug': slugify(category_name)},
            )
            for name, description, price, stock, offer in products:
                _, created = Product.objects.get_or_create(
                    category=category,
                    name=name,
                    defaults={
                        'description': description,
                        'price': price,
                        'stock': stock,
                        'offer_percent': offer,
                        'image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
                    },
                )
                if created:
                    created_count += 1

        self.stdout.write(self.style.SUCCESS(f'Seed completed. New products: {created_count}'))

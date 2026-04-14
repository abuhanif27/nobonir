import json
from pathlib import Path
from time import perf_counter

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from products.models import Category, Product


class Command(BaseCommand):
    help = "Profiles hot API endpoints and writes a baseline JSON file"

    def handle(self, *args, **options):
        User = get_user_model()
        user, _ = User.objects.get_or_create(
            email="perf-profile@example.com",
            defaults={
                "username": "perfprofile",
                "first_name": "Perf",
                "last_name": "Profile",
                "role": "CUSTOMER",
            },
        )
        user.set_password("Secret123!")
        user.save(update_fields=["password"])

        category, _ = Category.objects.get_or_create(name="Perf", slug="perf")
        if not Product.objects.filter(is_active=True).exists():
            self.stdout.write(
                self.style.WARNING(
                    "No active products found. Seed products before running profile_api."
                )
            )
            return

        client = APIClient()
        client.force_authenticate(user=user)

        endpoints = [
            {"name": "products_list", "path": "/api/products/", "method": "get"},
            {"name": "products_merchandising", "path": "/api/products/merchandising/", "method": "get"},
            {"name": "ai_recommendations", "path": "/api/ai/recommendations/personalized/", "method": "get"},
            {
                "name": "assistant_chat",
                "path": "/api/ai/assistant/chat/",
                "method": "post",
                "data": {"message": "show me top selling products"},
            },
        ]

        results = []
        for endpoint in endpoints:
            start = perf_counter()
            with CaptureQueriesContext(connection) as query_context:
                if endpoint["method"] == "post":
                    response = client.post(endpoint["path"], endpoint.get("data", {}), format="json")
                else:
                    response = client.get(endpoint["path"])
            duration_ms = round((perf_counter() - start) * 1000, 2)
            results.append(
                {
                    "name": endpoint["name"],
                    "path": endpoint["path"],
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "query_count": len(query_context),
                }
            )

        payload = {
            "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "results": results,
        }

        root = Path(__file__).resolve().parents[4]
        baseline_file = root / "audit_api_performance_baseline.json"
        baseline_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Wrote baseline to {baseline_file}"))
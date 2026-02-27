from datetime import timedelta

from django.db import migrations, models
from django.conf import settings
from django.utils import timezone


def seed_nobonir_coupon(apps, schema_editor):
    Coupon = apps.get_model("orders", "Coupon")
    Coupon.objects.update_or_create(
        code="NOBONIR",
        defaults={
            "discount_percent": 10,
            "is_active": True,
            "expires_at": timezone.now() + timedelta(days=365),
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("orders", "0002_order_billing_address"),
    ]

    operations = [
        migrations.CreateModel(
            name="Coupon",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(db_index=True, max_length=40, unique=True)),
                ("discount_percent", models.PositiveSmallIntegerField(default=10)),
                ("expires_at", models.DateTimeField()),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="order",
            name="coupon_code",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="order",
            name="discount_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="order",
            name="subtotal_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.CreateModel(
            name="CouponUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("used_at", models.DateTimeField(auto_now_add=True)),
                (
                    "coupon",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="usages", to="orders.coupon"),
                ),
                (
                    "order",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="coupon_usages", to="orders.order"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="coupon_usages",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="couponusage",
            constraint=models.UniqueConstraint(fields=("user", "coupon"), name="unique_user_coupon_usage"),
        ),
        migrations.RunPython(seed_nobonir_coupon, migrations.RunPython.noop),
    ]

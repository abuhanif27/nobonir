from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AnalyticsEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_name", models.CharField(db_index=True, max_length=80)),
                (
                    "source",
                    models.CharField(
                        choices=[("frontend", "Frontend"), ("backend", "Backend")],
                        db_index=True,
                        default="frontend",
                        max_length=20,
                    ),
                ),
                ("session_key", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("path", models.CharField(blank=True, default="", max_length=255)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="analytics_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="analyticsevent",
            index=models.Index(fields=["event_name", "created_at"], name="analytics_e_event_n_4da5b5_idx"),
        ),
        migrations.AddIndex(
            model_name="analyticsevent",
            index=models.Index(fields=["source", "created_at"], name="analytics_e_source_1236da_idx"),
        ),
    ]

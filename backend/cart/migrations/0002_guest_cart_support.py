# Generated migration for guest cart support

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cart',
            name='user',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name='cart',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='cart',
            name='session_key',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=40,
                null=True,
            ),
        ),
        migrations.AddConstraint(
            model_name='cart',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ('user__isnull', False),
                    ('session_key__isnull', False),
                    _connector='OR',
                ),
                name='cart_must_have_user_or_session',
            ),
        ),
    ]

from django.db import models

from orders.models import Order


class Payment(models.Model):
	class Status(models.TextChoices):
		PENDING = "PENDING", "Pending"
		SUCCESS = "SUCCESS", "Success"
		FAILED = "FAILED", "Failed"

	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
	amount = models.DecimalField(max_digits=12, decimal_places=2)
	method = models.CharField(max_length=50, default="SIMULATED")
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
	transaction_id = models.CharField(max_length=80, unique=True)
	created_at = models.DateTimeField(auto_now_add=True)

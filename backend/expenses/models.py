from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

MIN_AMOUNT = Decimal("0.01")
MAX_AMOUNT = Decimal("99999999.99")


class Category(models.TextChoices):
    FOOD = "Food", "Food"
    TRANSPORT = "Transport", "Transport"
    SHOPPING = "Shopping", "Shopping"
    BILLS = "Bills", "Bills"
    ENTERTAINMENT = "Entertainment", "Entertainment"
    OTHER = "Other", "Other"


class Expense(models.Model):
    title = models.CharField(max_length=200)
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(MIN_AMOUNT), MaxValueValidator(MAX_AMOUNT)],
    )
    category = models.CharField(max_length=20, choices=Category.choices)
    date = models.DateField(default=timezone.localdate)
    note = models.TextField(max_length=2000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at", "-id"]
        indexes = [models.Index(fields=["-date", "-created_at", "-id"], name="expense_date_order")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=MIN_AMOUNT, amount__lte=MAX_AMOUNT),
                name="expense_amount_in_range",
            ),
            models.CheckConstraint(
                condition=models.Q(category__in=Category.values),
                name="expense_category_valid",
            ),
        ]

    def __str__(self) -> str:
        return self.title

from calendar import monthrange
from collections.abc import Mapping
from datetime import timedelta
from decimal import Decimal

from django.db.models import QuerySet
from django.utils import timezone

from .models import Category, Expense


def filter_expenses(queryset: QuerySet[Expense], params: Mapping) -> QuerySet[Expense]:
    if category := params.get("category"):
        queryset = queryset.filter(category=category)
    if start_date := params.get("start_date"):
        queryset = queryset.filter(date__gte=start_date)
    if end_date := params.get("end_date"):
        queryset = queryset.filter(date__lte=end_date)
    if title := params.get("title"):
        queryset = queryset.filter(title__icontains=title)
    return queryset


def monthly_summary() -> dict:
    month_start = timezone.localdate().replace(day=1)
    days_in_month = monthrange(month_start.year, month_start.month)[1]
    next_month_start = month_start + timedelta(days=days_in_month)

    rows = (
        Expense.objects.filter(date__gte=month_start, date__lt=next_month_start)
        .order_by()
        .values_list("category", "amount")
    )
    by_category = dict.fromkeys(Category.values, Decimal("0.00"))
    total = Decimal("0.00")
    expense_count = 0
    # Django converts each stored amount to Decimal. SQLite's SUM can use floats.
    for category, amount in rows.iterator():
        by_category[category] += amount
        total += amount
        expense_count += 1

    return {
        "month": month_start.isoformat()[:7],
        "currency": "INR",
        "total": format(total, ".2f"),
        "expense_count": expense_count,
        "by_category": [
            {"category": category, "total": format(subtotal, ".2f")}
            for category, subtotal in by_category.items()
        ],
    }

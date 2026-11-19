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


def spending_summary(*, today_only: bool = False) -> dict:
    today = timezone.localdate()
    if today_only:
        period = {"date": today.isoformat()}
        expenses = Expense.objects.filter(date=today)
    else:
        month_start = today.replace(day=1)
        days_in_month = monthrange(today.year, today.month)[1]
        next_month_start = month_start + timedelta(days=days_in_month)
        period = {"month": month_start.isoformat()[:7]}
        expenses = Expense.objects.filter(date__gte=month_start, date__lt=next_month_start)

    rows = expenses.order_by().values_list("category", "amount")
    by_category = dict.fromkeys(Category.values, Decimal("0.00"))
    total = Decimal("0.00")
    expense_count = 0
    # Django converts each stored amount to Decimal. SQLite's SUM can use floats.
    for category, amount in rows.iterator():
        by_category[category] += amount
        total += amount
        expense_count += 1

    return {
        **period,
        "currency": "INR",
        "total": format(total, ".2f"),
        "expense_count": expense_count,
        "by_category": [
            {"category": category, "total": format(subtotal, ".2f")}
            for category, subtotal in by_category.items()
        ],
    }

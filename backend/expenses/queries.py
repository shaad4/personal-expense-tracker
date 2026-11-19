from collections.abc import Mapping

from django.db.models import QuerySet

from .models import Expense


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

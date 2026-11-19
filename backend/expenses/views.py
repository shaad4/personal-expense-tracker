from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Category, Expense
from .parsers import ExpenseJSONParser
from .queries import filter_expenses, spending_summary
from .serializers import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    ExpenseListQuerySerializer,
    ExpenseSerializer,
)


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


class ExpensePagination(PageNumberPagination):
    page_size = DEFAULT_PAGE_SIZE
    max_page_size = MAX_PAGE_SIZE
    page_size_query_param = "page_size"


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    pagination_class = ExpensePagination
    parser_classes = [ExpenseJSONParser]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            query = ExpenseListQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            return filter_expenses(queryset, query.validated_data)
        return queryset

    def get_serializer(self, *args, **kwargs):
        # DRF represents a missing body as {}, which is also a valid empty PATCH.
        if "data" in kwargs and self.request.stream is None:
            raise ParseError("Expected a JSON object in the request body.")
        return super().get_serializer(*args, **kwargs)

    @action(detail=False, methods=["get"])
    def categories(self, request):
        return Response([{"value": value, "label": label} for value, label in Category.choices])

    @action(detail=False, methods=["get"])
    def summary(self, request):
        period = request.query_params.get("period", "month")
        if period not in ("month", "today"):
            raise ValidationError({"period": ["Choose month or today."]})
        return Response(spending_summary(today_only=period == "today"))

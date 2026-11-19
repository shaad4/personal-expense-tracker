from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from .models import Expense
from .parsers import ExpenseJSONParser
from .serializers import ExpenseSerializer


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    parser_classes = [ExpenseJSONParser]
    lookup_value_regex = "[0-9]+"

    def get_serializer(self, *args, **kwargs):
        # DRF represents a missing body as {}, which is also a valid empty PATCH.
        if "data" in kwargs and self.request.stream is None:
            raise ParseError("Expected a JSON object in the request body.")
        return super().get_serializer(*args, **kwargs)

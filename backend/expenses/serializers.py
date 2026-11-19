import re
from collections.abc import Mapping

from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.fields import empty

from .models import MAX_AMOUNT, MIN_AMOUNT, Category, Expense
from .validators import normalize_plain_text

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class PlainTextField(serializers.CharField):
    def __init__(self, *, multiline=False, **kwargs):
        self.multiline = multiline
        super().__init__(**kwargs)

    def run_validation(self, data=empty):
        # Check before CharField trims whitespace or coerces numeric values to text.
        if isinstance(data, str):
            data = normalize_plain_text(data, multiline=self.multiline)
        elif data is not empty and data is not None:
            self.fail("invalid")
        return super().run_validation(data)


class CategoryField(serializers.ChoiceField):
    default_error_messages = {"invalid_choice": "Select a valid category."}

    def __init__(self, **kwargs):
        super().__init__(choices=Category.choices, **kwargs)

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid_choice")
        return super().to_internal_value(data.strip())


class DateOnlyField(serializers.DateField):
    def to_internal_value(self, data):
        if not isinstance(data, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", data):
            self.fail("invalid", format="YYYY-MM-DD")
        return super().to_internal_value(data)


class StrictBooleanField(serializers.BooleanField):
    def to_internal_value(self, data):
        if not isinstance(data, bool):
            self.fail("invalid")
        return data


class AmountField(serializers.DecimalField):
    def to_internal_value(self, data):
        # Decimal accepts underscores even in strings like "1__0".
        if isinstance(data, str) and "_" in data:
            self.fail("invalid")
        return super().to_internal_value(data)


def check_input_keys(data: Mapping, fields: Mapping) -> None:
    errors = {}
    for name in data:
        if name not in fields:
            # Even an invalid JSON key must be safe to echo in a UTF-8 response.
            key = name.encode("utf-8", errors="backslashreplace").decode("utf-8")
            errors[key] = ["Unknown field."]
        elif fields[name].read_only:
            errors[name] = ["This field is read-only."]
    if errors:
        raise serializers.ValidationError(errors)


class ExpenseSerializer(serializers.ModelSerializer):
    title = PlainTextField(max_length=200)
    amount = AmountField(
        max_digits=10,
        decimal_places=2,
        min_value=MIN_AMOUNT,
        max_value=MAX_AMOUNT,
        coerce_to_string=True,
    )
    category = CategoryField()
    date = DateOnlyField(required=False)
    allow_future_date = StrictBooleanField(write_only=True, default=False)
    note = PlainTextField(multiline=True, allow_blank=True, max_length=2000, default="")

    class Meta:
        model = Expense
        fields = (
            "id",
            "title",
            "amount",
            "category",
            "date",
            "allow_future_date",
            "note",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        allow_future_date = attrs.pop("allow_future_date", False)
        date = attrs.get("date")
        if date is not None and date > timezone.localdate() and not allow_future_date:
            raise serializers.ValidationError({"date": "Enable future dates to use this date."})
        return attrs

    def get_fields(self):
        fields = super().get_fields()
        # Creation uses the model's local-date default. A replacement needs a date.
        fields["date"].required = self.instance is not None and not self.partial
        return fields

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            check_input_keys(data, self.fields)
        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        if validated_data:
            for field, value in validated_data.items():
                setattr(instance, field, value)
            # Concurrent PATCH requests can update independent fields.
            try:
                instance.save(update_fields=[*validated_data, "updated_at"])
            except Expense.NotUpdated as exc:
                raise NotFound("This expense has been deleted.") from exc
        return instance


class PageIntegerField(serializers.IntegerField):
    def to_internal_value(self, data):
        if not re.fullmatch(r"[0-9]+", str(data)):
            self.fail("invalid")
        return super().to_internal_value(data)


class ExpenseListQuerySerializer(serializers.Serializer):
    category = CategoryField(required=False)
    start_date = DateOnlyField(required=False)
    end_date = DateOnlyField(required=False)
    title = serializers.CharField(max_length=200, required=False)
    page = PageIntegerField(min_value=1, default=1)
    page_size = PageIntegerField(min_value=1, max_value=MAX_PAGE_SIZE, default=DEFAULT_PAGE_SIZE)

    def to_internal_value(self, data):
        check_input_keys(data, self.fields)
        # A plain dict also avoids HTML form semantics for blank query values.
        params = dict(data.items())
        for name in ("category", "start_date", "end_date", "title"):
            if name in params and not params[name].strip():
                del params[name]
        return super().to_internal_value(params)

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if start and end and start > end:
            raise serializers.ValidationError({"end_date": "Must be on or after start_date."})
        return attrs

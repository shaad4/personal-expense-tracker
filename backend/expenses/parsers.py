import codecs
from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser, get_encoding
from rest_framework.utils import json


class ExpenseJSONParser(JSONParser):
    """Keep the precision of numeric JSON tokens until amount validation."""

    def parse(self, stream, media_type=None, parser_context=None):
        reader = codecs.getreader(get_encoding(parser_context or {}))(stream)
        try:
            return json.load(reader, parse_float=Decimal, parse_constant=json.strict_constant)
        except RecursionError as exc:
            raise ParseError("JSON nesting exceeds the supported depth.") from exc
        except (ValueError, InvalidOperation) as exc:
            raise ParseError(f"JSON parse error - {exc}") from exc

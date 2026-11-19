from unicodedata import category

from rest_framework.exceptions import ValidationError


def normalize_plain_text(value: str, *, multiline: bool) -> str:
    if multiline:
        value = value.replace("\r\n", "\n").replace("\r", "\n")
    for char in value:
        if multiline and char in "\n\t":
            continue
        kind = category(char)
        if kind in {"Cc", "Cs"} or (not multiline and kind in {"Zl", "Zp"}):
            raise ValidationError(
                "This text contains an unsupported control or line-break character."
            )
    return value.strip()

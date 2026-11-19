from datetime import UTC, datetime
from unittest.mock import patch

from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase

from .models import Expense

EXPENSES = "/api/expenses/"
SUMMARY = EXPENSES + "summary/"
CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Other"]
MEAL = {"title": "Lunch", "amount": "125.50", "category": "Food"}


class ExpenseAPITests(APITestCase):
    def create_expense(self, **changes):
        response = self.client.post(EXPENSES, {**MEAL, **changes}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def test_health_categories_and_methods(self):
        self.assertEqual(self.client.get("/api/health/").json(), {"status": "ok"})
        response = self.client.get(EXPENSES + "categories/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"value": v, "label": v} for v in CATEGORIES])
        self.assertEqual(self.client.post(SUMMARY, {}, format="json").status_code, 405)

    @patch("django.utils.timezone.now", return_value=datetime(2026, 11, 30, 19, tzinfo=UTC))
    def test_local_date_and_plain_text(self, _now):
        title = "ചായ & Sam's <b>snack</b>"
        expense = self.create_expense(title=f"  {title} ", amount=0.1, category=" Food ")
        self.assertEqual(expense["title"], title)
        self.assertEqual(expense["date"], "2026-12-01")
        self.assertEqual(expense["amount"], "0.10")
        self.assertEqual(expense["category"], "Food")
        self.assertEqual(expense["note"], "")
        note = self.create_expense(note="  first\r\nnext\titem\rlast  ")["note"]
        self.assertEqual(note, "first\nnext\titem\nlast")

    def test_invalid_fields(self):
        invalid = {
            "title": [None, " ", 123, False, [], {}, "T" * 201, "\nmeal", "a\x00b", "a\x1fb"],
            "amount": [
                None,
                "",
                True,
                "0",
                "-0.01",
                "9.999",
                "100000000",
                "NaN",
                "Infinity",
                "free",
            ],
            "category": [None, 2, "food", "unknown"],
            "date": [None, "", 20260101, "2026-2-1", "2026-02-30", "2026-01-01T12:00:00Z"],
            "note": [None, True, 123, [], {}, "N" * 2001, "bad\x00", "\x08bad"],
            "id": [10],
            "created_at": ["2026-01-01"],
            "updated_at": ["2026-01-01"],
            "extra": ["unexpected"],
        }
        for field, values in invalid.items():
            for value in values:
                with self.subTest(field=field, value=repr(value)[:40]):
                    response = self.client.post(EXPENSES, {**MEAL, field: value}, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(field, response.json())
        missing = self.client.post(EXPENSES, {}, format="json")
        self.assertEqual(missing.status_code, 400)
        self.assertTrue(MEAL.keys() <= missing.json().keys())
        self.assertFalse(Expense.objects.exists())

    def test_json_body_and_numeric_precision(self):
        for body in [b"[]", b"42", b"null", b'"text"', b"{broken"]:
            with self.subTest(body=body):
                response = self.client.post(EXPENSES, body, content_type="application/json")
                self.assertEqual(response.status_code, 400)
        unsupported = self.client.post(EXPENSES, b"x=y", content_type="text/plain")
        self.assertEqual(unsupported.status_code, 415)
        body = b'{"title":"Coffee","category":"Food","amount":0.10000000000000000001}'
        response = self.client.post(EXPENSES, body, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("amount", response.json())

    def test_database_constraints(self):
        for changes in [{"category": "Unexpected"}, {"amount": "0.00"}, {"amount": "100000000.00"}]:
            with (
                self.subTest(changes=changes),
                self.assertRaises(IntegrityError),
                transaction.atomic(),
            ):
                Expense.objects.create(**{**MEAL, **changes})

    def test_update_contract_rollback_and_delete(self):
        original = self.create_expense(date="2020-06-15", note="keep")
        detail = f"{EXPENSES}{original['id']}/?category=Bills"
        self.assertEqual(self.client.get(detail).json(), original)
        bodyless = self.client.generic("PATCH", detail, b"", content_type="application/json")
        self.assertEqual(bodyless.status_code, 400)
        self.assertEqual(self.client.patch(detail, {}, format="json").json(), original)
        response = self.client.patch(detail, {"title": "Tea"}, format="json")
        self.assertEqual(response.status_code, 200)
        edited = response.json()
        self.assertEqual(edited["title"], "Tea")
        for field in ["date", "note", "amount", "category", "created_at", "id"]:
            self.assertEqual(edited[field], original[field])
        invalid = self.client.patch(detail, {"title": "Discard", "amount": 0}, format="json")
        self.assertEqual(invalid.status_code, 400)
        missing_date = self.client.put(detail, MEAL, format="json")
        self.assertEqual(missing_date.status_code, 400)
        self.assertIn("date", missing_date.json())
        self.assertEqual(self.client.get(detail).json(), edited)
        replaced = self.client.put(detail, {**MEAL, "date": "2032-02-29"}, format="json")
        self.assertEqual(replaced.status_code, 200)
        self.assertEqual(replaced.json()["date"], "2032-02-29")
        self.assertEqual(replaced.json()["note"], "")
        self.assertEqual(replaced.json()["created_at"], original["created_at"])
        deleted = self.client.delete(detail)
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(deleted.content, b"")
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.assertEqual(self.client.patch(detail, {"note": ""}, format="json").status_code, 404)
        missing = self.client.put(detail, {**MEAL, "date": "2032-02-29"}, format="json")
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(self.client.delete(detail).status_code, 404)

    def test_combined_filters_and_boundaries(self):
        for day in ["2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01"]:
            self.create_expense(title="Iced COFFEE", date=day)
        self.create_expense(title="Coffee mug", date="2026-11-01", category="Shopping")
        self.create_expense(title="Lunch", date="2026-11-30")
        filters = {
            "category": "Food",
            "title": " coffee ",
            "start_date": "2026-11-01",
            "end_date": "2026-11-30",
        }
        rows = self.client.get(EXPENSES, filters).json()["results"]
        self.assertEqual([row["date"] for row in rows], ["2026-11-30", "2026-11-01"])
        self.assertEqual(self.client.get(EXPENSES, {"start_date": "2026-11-01"}).json()["count"], 5)
        self.assertEqual(self.client.get(EXPENSES, {"end_date": "2026-11-30"}).json()["count"], 5)
        blank_filters = dict.fromkeys(filters, "  ")
        self.assertEqual(self.client.get(EXPENSES, blank_filters).json()["count"], 6)
        response = self.client.get(EXPENSES, {"title": "missing"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"count": 0, "next": None, "previous": None, "results": []}
        )

    def test_invalid_list_parameters(self):
        for params in [
            {"start_date": "2026-01-02", "end_date": "2026-01-01"},
            {"end_date": "2026-2-1"},
            {"category": "groceries"},
            {"title": "a" * 201},
            {"amount__gte": "100"},
            {"format": "xml"},
            {"page": "last"},
            {"page": "0"},
            {"page_size": "-1"},
            {"page_size": "1.5"},
            {"page_size": "101"},
        ]:
            with self.subTest(params=params):
                self.assertEqual(self.client.get(EXPENSES, params).status_code, 400)

    def test_pagination_and_deterministic_ties(self):
        rows = Expense.objects.bulk_create([Expense(**MEAL, date="2026-01-01") for _ in range(21)])
        # Force a real timestamp tie so pagination exercises the final id tie-break.
        Expense.objects.all().update(created_at=rows[0].created_at)
        first = self.client.get(EXPENSES).json()
        self.assertEqual(first["count"], 21)
        self.assertIsNone(first["previous"])
        self.assertIsNotNone(first["next"])
        ids = [row["id"] for row in first["results"]]
        self.assertEqual(ids, [row.pk for row in reversed(rows[1:])])
        second = self.client.get(first["next"]).json()
        self.assertIsNone(second["next"])
        self.assertIsNotNone(second["previous"])
        self.assertEqual([row["id"] for row in second["results"]], [rows[0].pk])
        self.assertEqual(len(self.client.get(EXPENSES, {"page_size": "3"}).json()["results"]), 3)
        self.assertEqual(self.client.get(EXPENSES, {"page": "3"}).status_code, 404)

    @patch("django.utils.timezone.now", return_value=datetime(2026, 11, 30, 19, tzinfo=UTC))
    def test_december_summary_and_mutations(self, _now):
        self.create_expense(date="2026-11-30")
        self.create_expense(date="2027-01-01")
        empty = self.client.get(SUMMARY).json()
        self.assertEqual(
            empty,
            {
                "month": "2026-12",
                "currency": "INR",
                "total": "0.00",
                "expense_count": 0,
                "by_category": [{"category": category, "total": "0.00"} for category in CATEGORIES],
            },
        )
        self.create_expense(date="2026-12-01", amount="0.10")
        later = self.create_expense(date="2026-12-31", amount="0.20", category="Other")
        with self.assertNumQueries(1):
            summary = self.client.get(SUMMARY, {"page": "4", "category": "Bills"}).json()
        self.assertEqual(summary["expense_count"], 2)
        self.assertEqual(summary["total"], "0.30")
        totals = {entry["category"]: entry["total"] for entry in summary["by_category"]}
        self.assertEqual(
            totals, {**dict.fromkeys(CATEGORIES, "0.00"), "Food": "0.10", "Other": "0.20"}
        )
        detail = f"{EXPENSES}{later['id']}/"
        self.assertEqual(
            self.client.patch(detail, {"amount": "99999999.99"}, format="json").status_code, 200
        )
        self.assertEqual(self.client.get(SUMMARY).json()["total"], "100000000.09")
        self.assertEqual(self.client.delete(detail).status_code, 204)
        final = self.client.get(SUMMARY).json()
        self.assertEqual((final["expense_count"], final["total"]), (1, "0.10"))

    def test_local_cors_requests(self):
        for origin in ["http://localhost:3000", "http://127.0.0.1:3000"]:
            with self.subTest(origin=origin):
                actual = self.client.get(EXPENSES, HTTP_ORIGIN=origin)
                self.assertEqual(actual["Access-Control-Allow-Origin"], origin)
                preflight = self.client.options(
                    EXPENSES,
                    HTTP_ORIGIN=origin,
                    HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
                    HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type",
                )
                self.assertEqual(preflight["Access-Control-Allow-Origin"], origin)
                self.assertIn("POST", preflight["Access-Control-Allow-Methods"])
                self.assertIn("content-type", preflight["Access-Control-Allow-Headers"].lower())
        other = self.client.get(EXPENSES, HTTP_ORIGIN="https://other.example")
        self.assertNotIn("Access-Control-Allow-Origin", other)

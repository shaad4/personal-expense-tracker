# Personal expense tracker

A local, single-user Django REST API for recording INR expenses. It supports CRUD, filtered and paginated history, and a spending breakdown for the current calendar month in Asia/Kolkata. SQLite stores expenses in `backend/db.sqlite3`. The `frontend/` directory is reserved for the next phase.

## Run locally

On a fresh checkout, run these commands from the repository root in a POSIX shell. Python 3.12.3 was used for development.

```sh
python3.12 -m venv .venv
. .venv/bin/activate
cd backend
python -m pip install --only-binary=:all: --upgrade 'pip>=26.3'
python -m pip install -r requirements-dev.txt
(
  umask 077
  cp .env.example .env
  python -c "import secrets; from dotenv import set_key; set_key('.env', 'DJANGO_SECRET_KEY', secrets.token_urlsafe(50))"
  python manage.py migrate
)
python manage.py runserver 127.0.0.1:8000
```

The first-time setup creates the secret and SQLite database with owner-only permissions. On subsequent runs, activate the environment, enter `backend/`, apply new migrations with `python manage.py migrate`, and start the server. The API accepts hosts `localhost` and `127.0.0.1`. A second terminal can check the server with `curl http://127.0.0.1:8000/api/health/`.

Settings load from `backend/.env`, with existing environment variables taking precedence. Keep the generated `DJANGO_SECRET_KEY` private. `DJANGO_DEBUG=False` is the default. `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist that defaults to `http://localhost:3000,http://127.0.0.1:3000`. Both the database and the local environment file are ignored by Git.

The runtime pins are Django 6.1.3, Django REST Framework 3.18.3, django-cors-headers 4.9.0, and python-dotenv 1.2.4. The development install adds Ruff 0.17.5. [Runtime requirements](backend/requirements.txt) · [Development requirements](backend/requirements-dev.txt)

## API contract

Use the `/api/` base path and include the trailing slash. Send one JSON object with `Content-Type: application/json` when creating or editing. The API allows local clients to read and write without credentials.

| Method | Path | Success |
| --- | --- | --- |
| GET | `/api/health/` | 200, `{"status":"ok"}` |
| GET | `/api/expenses/` | 200, paginated list |
| POST | `/api/expenses/` | 201, created expense |
| GET | `/api/expenses/{id}/` | 200, expense |
| PUT | `/api/expenses/{id}/` | 200, replaced expense |
| PATCH | `/api/expenses/{id}/` | 200, updated expense |
| DELETE | `/api/expenses/{id}/` | 204, empty body |
| GET | `/api/expenses/categories/` | 200, array of value/label pairs such as `{"value":"Food","label":"Food"}` |
| GET | `/api/expenses/summary/` | 200, current-month totals |

An expense response looks like this.

```json
{
  "id": 7,
  "title": "Coffee & snacks",
  "amount": "125.50",
  "category": "Food",
  "date": "2026-11-03",
  "note": "",
  "created_at": "2026-11-03T09:30:00+05:30",
  "updated_at": "2026-11-03T09:30:00+05:30"
}
```

| Write | Required fields | Omitted fields |
| --- | --- | --- |
| POST | `title`, `amount`, `category` | `date` defaults to today in Asia/Kolkata and `note` to `""`. |
| PUT | `title`, `amount`, `category`, `date` | `note` resets to `""`. |
| PATCH | Supply the fields you want to change. | Each omitted field keeps its value. |

The server manages `id`, `created_at`, and `updated_at`. Supplying one of these or an unknown key returns 400. A failed write leaves the stored expense intact.

- **Title and note.** Both take JSON strings. The title must contain 1–200 characters after trimming and fit on a single line. The optional note accepts up to 2,000 characters after normalization. CRLF and CR become LF. Surrounding whitespace is trimmed and internal line breaks and tabs in notes are preserved. Nulls and inappropriate control characters are rejected.
- **Amount.** Send a decimal string such as `"125.50"` to preserve precision across JavaScript and JSON. JSON numbers are also accepted. The inclusive range is `0.01` through `99999999.99`, with at most two decimal places. Extra precision produces a validation error. All monetary responses are strings with exactly two decimal places.
- **Category and date.** Category is a case-sensitive string, trimmed before matching. Use Food, Transport, Shopping, Bills, Entertainment, or Other. Dates are valid `YYYY-MM-DD` strings. Future dates and repeated titles are allowed.
- **Rendering.** Title and note are untrusted plain text. The API preserves punctuation, Malayalam, and HTML-looking input. Render them through escaped React text expressions such as `<span>{expense.title}</span>`. Never pass them to `dangerouslySetInnerHTML`.

Invalid body fields and list parameters return 400 with field-specific errors. For example, a blank title and zero amount yield this response.

```json
{"title":["This field may not be blank."],"amount":["Ensure this value is greater than or equal to 0.01."]}
```

Missing records return 404, unsupported methods return 405, malformed JSON returns 400, and unsupported request media types return 415. DRF reports these request-level errors with a `detail` key.

### Filters and pagination

The list accepts `category`, `start_date`, `end_date`, `title`, `page`, and `page_size`. All supplied filters apply together. Date bounds are inclusive, and either may be used alone. Title matches a case-insensitive substring, with surrounding whitespace trimmed and a 200-character limit. Empty or whitespace-only filters are ignored. Unknown parameters, invalid values, and reversed date ranges return 400.

Pages start at 1. The default size is 20 and the maximum is 100. Both pagination arguments require positive integers. Expenses are ordered by descending expense date, then descending creation time, then descending ID. A page contains `count`, `next`, `previous`, and `results`, with full expense objects in `results`. The pagination links are absolute URLs or `null`. An out-of-range page returns 404. An empty first page returns 200 with this body.

```json
{"count":0,"next":null,"previous":null,"results":[]}
```

### Monthly summary

The summary always covers the current calendar month in Asia/Kolkata, independently of list filters and pagination. The query selects category and amount from the first day of this month up to the first day of next month, excluding that upper bound. It streams the rows once and adds ORM-provided Decimal amounts in Python to avoid SQLite's floating-point SUM. Totals can exceed the per-expense maximum. For example, two Food expenses of `0.10` and `0.20` in November 2026 give this response when they are the month's only records.

```json
{
  "month": "2026-11",
  "currency": "INR",
  "total": "0.30",
  "expense_count": 2,
  "by_category": [
    {"category": "Food", "total": "0.30"},
    {"category": "Transport", "total": "0.00"},
    {"category": "Shopping", "total": "0.00"},
    {"category": "Bills", "total": "0.00"},
    {"category": "Entertainment", "total": "0.00"},
    {"category": "Other", "total": "0.00"}
  ]
}
```

### Try the API

Run these commands in a second terminal with Python 3 available. They create an example record, use the ID returned by the server, and delete that record at the end.

```sh
api=http://127.0.0.1:8000/api
json='Content-Type: application/json'

item=$(curl -fsS -X POST "$api/expenses/" -H "$json" \
  -d '{"title":"Coffee","amount":"125.50","category":"Food","date":"2026-11-03"}')
id=$(printf '%s' "$item" | python3 -c 'import json, sys; print(json.load(sys.stdin)["id"])')
curl -fsS "$api/expenses/$id/"

curl -fsS -X PUT "$api/expenses/$id/" -H "$json" \
  -d '{"title":"Coffee & snacks","amount":"145.50","category":"Food","date":"2026-11-03"}'
curl -fsS -X PATCH "$api/expenses/$id/" -H "$json" -d '{"note":"Shared breakfast"}'

curl -fsS -G "$api/expenses/" \
  --data-urlencode 'category=Food' --data-urlencode 'title=coffee' \
  --data-urlencode 'start_date=2026-11-01' --data-urlencode 'end_date=2026-11-30' \
  --data-urlencode 'page=1' --data-urlencode 'page_size=20'
curl -fsS "$api/expenses/categories/"
curl -fsS "$api/expenses/summary/"
curl -fsS -i -X DELETE "$api/expenses/$id/"
```

## Verification and layout

With the virtual environment active, run these checks from `backend/`. Django's test runner uses a separate database for the API checks.

```sh
python -m pip check
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test expenses
ruff check .
ruff format --check .
```

```text
.
├── README.md
├── .gitignore
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── pyproject.toml
│   ├── .env.example
│   ├── config/           # settings, URLs, ASGI, WSGI
│   └── expenses/         # model, serializers, validators, queries, views, URLs, tests
│       └── migrations/   # includes 0001_initial.py
└── frontend/
    └── .gitkeep
```

This phase is intended for one person on a trusted local machine. All clients that can reach the API share the same expenses. CORS controls access from browser origins. SQLite and the one-pass monthly calculation suit a small personal history. User accounts, deployment configuration, and the Next.js interface are outside this phase.

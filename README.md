# Folio · Personal expense tracker

Folio is a local, single-user INR expense tracker. Add an expense with the icon-based category picker, select a ledger row to edit or delete it, and combine title, category, and date filters. The overview shows spending for today or the current calendar month in Asia/Kolkata. The responsive interface follows the device's light or dark appearance until you choose a theme in the header. That choice is saved in browser storage.

## Run locally

Use Python 3.12 with `venv`, Node.js 22.13 or later, npm, and a POSIX shell. To check out the development branch for review, run the commands below.

```sh
git clone --branch dev https://github.com/shaad4/personal-expense-tracker.git
cd personal-expense-tracker
```

Open two terminals at the repository root. Keep both servers running while using the tracker.

### Terminal 1 — Django API

On a fresh checkout, install the Python dependencies, create the local settings and database, and start the API.

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

The first-time setup creates the secret and SQLite database with owner-only permissions. Django stores expenses in `backend/db.sqlite3` across restarts. Check that the API is running with `curl -fsS http://127.0.0.1:8000/api/health/`. It should return `{"status":"ok"}`.

Settings load from `backend/.env`, with existing environment variables taking precedence. Keep the generated `DJANGO_SECRET_KEY` private. `DJANGO_DEBUG=False` is the default. `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist that defaults to `http://localhost:3000,http://127.0.0.1:3000`. Both the database and the local environment file are ignored by Git.

The runtime pins are Django 6.1.3, Django REST Framework 3.18.3, django-cors-headers 4.9.0, and python-dotenv 1.2.4. The development install adds Ruff 0.17.5. [Runtime requirements](backend/requirements.txt) · [Development requirements](backend/requirements-dev.txt)

### Terminal 2 — Next.js frontend

```sh
cd frontend
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open the [spending summary in Folio](http://127.0.0.1:3000/#monthly-summary). **This month** is selected by default. Choose **Today** to see the current day’s total, expense count, and category breakdown. Ledger filters operate independently.

The browser calls `http://127.0.0.1:8000/api` by default. To change the API URL, copy `frontend/.env.example` to `frontend/.env.local`, set `NEXT_PUBLIC_API_BASE_URL` to the backend URL including `/api`, and restart Next.js. If you change the frontend origin, add its exact origin to Django's `CORS_ALLOWED_ORIGINS` and restart Django. The default allowlist covers both local hostnames on port 3000.

### Subsequent runs

From the repository root, run the following commands in separate terminals. Reinstall dependencies if their requirement files or lockfile change.

```sh
# Terminal 1
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

```sh
# Terminal 2
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000
```

## Design choices and scope

| Choice | Reason and tradeoff |
| --- | --- |
| Django REST Framework and SQLite | The ORM, migrations, serializers, and router cover CRUD with one local database file. SQLite serializes writes, which suits one person's ledger. |
| Decimal money and a fixed category list | Django validates amounts and categories, and database checks enforce their bounds and choices. Totals use one pass over the selected period’s amounts with Python `Decimal`. Memory use stays bounded as the number of expenses grows. |
| Next.js, TypeScript, and CSS | The App Router hosts a responsive client with a typed API boundary. The editor catches field mistakes before submission and Django validates every write. Dates use `DD/MM/YYYY` in the interface and `YYYY-MM-DD` on the wire. Separate local servers require the API URL and browser origin to match the configuration above. |

**Local access.** Anyone who can reach the API can read and change the same expenses. This release intentionally skips accounts, ownership, and production deployment. Amounts use INR and all six categories are fixed. The ledger filters work across the full history.

**Connection loss.** Expense changes require a running API. The UI displays load or save errors and keeps the editor open after a failed save. There is no offline write queue. If the connection drops while saving, check the ledger before resubmitting. A repeated successful create produces another expense.

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
| GET | `/api/expenses/summary/` | 200, current-month totals by default or daily totals with `?period=today` |

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

The server manages `id`, `created_at`, and `updated_at`. Supplying one of these or an unknown key returns 400. A validation error leaves the stored expense intact.

- **Title and note.** Both take JSON strings. The title must contain 1–200 characters after trimming and fit on a single line. The optional note accepts up to 2,000 characters after normalization. CRLF and CR become LF. Surrounding whitespace is trimmed and internal line breaks and tabs in notes are preserved. Nulls and inappropriate control characters are rejected.
- **Amount.** Send a decimal string such as `"125.50"` to preserve precision across JavaScript and JSON. JSON numbers are also accepted. The inclusive range is `0.01` through `99999999.99`, with at most two decimal places. Extra precision produces a validation error. All monetary responses are strings with exactly two decimal places.
- **Category and date.** Category is a case-sensitive string, trimmed before matching. Use Food, Transport, Shopping, Bills, Entertainment, or Other. Expense dates use `YYYY-MM-DD` and may be today or earlier in Asia/Kolkata. Repeated titles are allowed.
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

### Spending summary

Omit `period` or use `?period=month` for the current calendar month. Use `?period=today` for expenses dated today in Asia/Kolkata. The daily response identifies the day with `date` in `YYYY-MM-DD` format in place of `month`. Both responses include `currency`, `total`, `expense_count`, and totals for all six categories, independently of ledger filters and pagination. Summing ORM-provided Decimal values avoids SQLite's floating-point SUM. Totals can exceed the per-expense maximum. For example, two Food expenses of `0.10` and `0.20` in November 2026 give this response when they are the month's only records.

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

Run these commands in another terminal with Python 3 available. They create an example record, use the ID returned by the server, and delete that record at the end.

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
curl -fsS "$api/expenses/summary/?period=today"
curl -fsS -i -X DELETE "$api/expenses/$id/"
```

## Verification

With the virtual environment active, run these checks from `backend/`. Django's test runner uses a separate database for the API checks.

```sh
python -m pip check
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test expenses
ruff check .
ruff format --check .
```

Run the frontend checks from `frontend/` after installing its dependencies.

```sh
npm run typecheck
npm run build
```

For a browser check, add a Food expense of `125.50` dated today, then filter the ledger by a different category. The ledger should hide the row while the month's total still includes it. Clear the filter, edit the row, and confirm that the total changes. Delete the example to restore your original data.

## Project layout

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
    ├── app/              # Next.js page, layout, and global styles
    ├── components/       # spending overview, expense history, and editor
    ├── lib/              # Django API client, formatting, and input validation
    ├── .env.example
    ├── next.config.ts
    ├── package.json
    ├── package-lock.json
    └── tsconfig.json
```

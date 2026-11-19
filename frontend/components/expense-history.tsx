"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, type CategoryOption, type Expense, type ExpenseFilters, type ExpensePage } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import { parseDisplayDate } from "../lib/validation";
import DateInput from "./date-input";
import { CategoryIcon, Icon } from "./icons";
import "./expense-history.css";

type Props = {
  categories: CategoryOption[];
  revision: number;
  onEdit: (expense: Expense) => void;
  onAdd: () => void;
};

type Filters = { category: string; start_date: string; end_date: string };
type ListState = { key: string; data: ExpensePage } | { key: string; error: string };
const emptyFilters: Filters = { category: "", start_date: "", end_date: "" };
const pageSize = 10;

export default function ExpenseHistory({ categories, revision, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<ExpenseFilters>({ page: 1, page_size: pageSize });
  const [result, setResult] = useState<ListState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filterError, setFilterError] = useState<{ field: "start_date" | "end_date"; message: string } | null>(null);
  const popoverId = useId();
  const filterContainer = useRef<HTMLDivElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const categorySelect = useRef<HTMLSelectElement>(null);
  const requestKey = JSON.stringify([query, revision, attempt]);
  const page = query.page || 1;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const term = search.trim();
      setQuery((current) => (current.title || "") === term
        ? current : { ...current, title: term, page: 1 });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    api.listExpenses(query, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key: requestKey, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      // Deleting the only row on the final page makes that page disappear.
      if (page > 1 && error instanceof ApiError && error.status === 404) {
        setQuery((current) => ({ ...current, page: page - 1 }));
        return;
      }
      setResult({ key: requestKey, error: error instanceof Error ? error.message : "Could not load expenses." });
    });
    return () => controller.abort();
  }, [query, page, requestKey]);

  useEffect(() => {
    if (!filterOpen) return;
    categorySelect.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !filterContainer.current?.contains(event.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [filterOpen]);

  function closeFilter() {
    setFilterOpen(false);
    filterTrigger.current?.focus();
  }

  function toggleFilter() {
    if (filterOpen) return closeFilter();
    setDraft({
      category: query.category || "",
      start_date: formatDate(query.start_date || ""),
      end_date: formatDate(query.end_date || ""),
    });
    setFilterError(null);
    setFilterOpen(true);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = parseDisplayDate(draft.start_date);
    const end = parseDisplayDate(draft.end_date);
    let error: typeof filterError = null;
    if (draft.start_date.trim() && !start) {
      error = { field: "start_date", message: "Enter a valid start date in DD/MM/YYYY format." };
    } else if (draft.end_date.trim() && !end) {
      error = { field: "end_date", message: "Enter a valid end date in DD/MM/YYYY format." };
    } else if (start && end && start > end) {
      error = { field: "end_date", message: "End date must be on or after start date." };
    }
    if (error) {
      setFilterError(error);
      const input = event.currentTarget.elements.namedItem(error.field);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setQuery((current) => ({ ...current, category: draft.category, start_date: start ?? "", end_date: end ?? "", page: 1 }));
    closeFilter();
  }

  function clearAll() {
    setSearch("");
    setQuery({ page: 1, page_size: pageSize });
  }

  const current = result?.key === requestKey ? result : null;
  const data = current && "data" in current ? current.data : null;
  const errorMessage = current && "error" in current ? current.error : "";
  const filterLabels = [
    query.category,
    query.start_date && `From ${formatDate(query.start_date)}`,
    query.end_date && `Through ${formatDate(query.end_date)}`,
  ].filter(Boolean);
  const filtered = Boolean(filterLabels.length || query.title);
  let statusText = "Loading expenses…";
  let statusAction: { label: string; run: () => void } | null = null;
  if (errorMessage) {
    statusText = "Couldn’t load expenses";
    statusAction = { label: "Try again", run: () => setAttempt((value) => value + 1) };
  } else if (data && data.results.length === 0) {
    statusText = filtered ? "No matching expenses" : "No expenses yet";
    statusAction = filtered
      ? { label: "Clear filters", run: clearAll }
      : { label: "Add your first expense", run: onAdd };
  }

  return (
    <section className="expense-history" id="expenses" aria-labelledby="history-title">
      <div className="history-heading">
        <div className="history-title">
          <h2 id="history-title">Expenses</h2>
          {data && <span className="history-count" aria-label={`${data.count} matching expenses`}>{data.count}</span>}
        </div>
        <div className="history-toolbar">
          <div className="history-search">
            <Icon name="search" size={16} />
            <input aria-label="Search expenses by title" type="search" placeholder="Search expenses"
              maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="history-filter" ref={filterContainer}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setFilterOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filterOpen) { event.preventDefault(); closeFilter(); }
            }}>
            <button type="button" className="history-filter-trigger" ref={filterTrigger} onClick={toggleFilter}
              aria-expanded={filterOpen} aria-controls={popoverId} aria-haspopup="dialog">
              <Icon name="sliders" size={16} /> Filter
              {filterLabels.length > 0 && <span className="history-filter-count">{filterLabels.length}</span>}
            </button>
            {filterOpen && (
              <div id={popoverId} className="history-popover" role="dialog" aria-label="Filter expenses">
                <form onSubmit={applyFilters}>
                  <div className="history-popover-title">Filter expenses</div>
                  <label>Category
                    <span className="history-select">
                      <select ref={categorySelect} value={draft.category}
                        onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                        <option value="">All categories</option>
                        {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                      <Icon name="chevron-down" size={14} />
                    </span>
                  </label>
                  <div className="history-dates">
                    {(["start_date", "end_date"] as const).map((field) => {
                      const label = field === "start_date" ? "Start date" : "End date";
                      const id = `${popoverId}-${field}`;
                      const invalid = filterError?.field === field;
                      return (
                        <div className="history-date-field" key={field}>
                          <label htmlFor={id}>{label}</label>
                          <DateInput id={id} name={field} value={draft[field]} aria-invalid={invalid}
                            aria-describedby={invalid ? `${popoverId}-error` : undefined}
                            calendarLabel={`Choose ${label.toLowerCase()} from calendar`}
                            onValueChange={(value) => {
                              setDraft({ ...draft, [field]: value }); setFilterError(null);
                            }} />
                        </div>
                      );
                    })}
                  </div>
                  {filterError && <p id={`${popoverId}-error`} role="alert" className="history-form-error">{filterError.message}</p>}
                  <div className="history-popover-actions">
                    <button type="button" onClick={() => {
                      setQuery((existing) => ({ ...existing, ...emptyFilters, page: 1 })); closeFilter();
                    }}>Reset</button>
                    <button type="submit" className="history-apply">Apply filters</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {filterLabels.length > 0 && (
        <div className="history-active">
          <span>{filterLabels.join(" · ")}</span>
          <button type="button" onClick={clearAll}>Clear filters</button>
        </div>
      )}
      <table className="history-table" aria-labelledby="history-title" aria-busy={!current}>
        <thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col">Amount</th></tr></thead>
        <tbody>
          {data?.results.map((expense) => (
            <tr key={expense.id} className="history-row">
              <td>
                <button type="button" className="history-entry" onClick={() => onEdit(expense)} aria-label={`Edit ${expense.title}`}>
                  <CategoryIcon category={expense.category} size={20} />
                  <span className="history-entry-text">
                    <span className="history-entry-title">{expense.title}</span>
                    {expense.note && <span className="history-entry-note">{expense.note}</span>}
                    <span className="history-mobile-meta">{expense.category} · {formatDate(expense.date)}</span>
                  </span>
                </button>
              </td>
              <td className="history-category">{expense.category}</td>
              <td className="history-date"><time dateTime={expense.date}>{formatDate(expense.date)}</time></td>
              <td className="history-amount">{formatMoney(expense.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.results.length && (
        <div className="history-state" role="status" aria-live="polite">
          <span className="history-state-icon"><Icon name={filtered && data ? "search" : "receipt"} size={23} /></span>
          <p>{statusText}</p>
          {errorMessage && <span className="history-state-detail">{errorMessage}</span>}
          {statusAction && <button type="button" onClick={statusAction.run}>{statusAction.label}</button>}
        </div>
      )}
      {data && data.count > pageSize && (
        <nav className="history-pagination" aria-label="Expense pages">
          <span>{(page - 1) * pageSize + 1}–{(page - 1) * pageSize + data.results.length} of {data.count}</span>
          <div>
            <button type="button" aria-label="Previous page" disabled={!data.previous} onClick={() => setQuery({ ...query, page: page - 1 })}><Icon name="chevron-left" size={16} /></button>
            <button type="button" aria-label="Next page" disabled={!data.next} onClick={() => setQuery({ ...query, page: page + 1 })}><Icon name="chevron-right" size={16} /></button>
          </div>
        </nav>
      )}
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError, type CategoryOption, type Expense, type ExpenseFilters, type ExpensePage } from "../lib/api";
import { formatMoney } from "../lib/format";
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
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});

function formatDate(value: string) {
  return shortDate.format(new Date(value + "T00:00:00Z"));
}

export default function ExpenseHistory({ categories, revision, onEdit, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<ExpenseFilters>({ page: 1, page_size: pageSize });
  const [result, setResult] = useState<ListState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filterError, setFilterError] = useState("");
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
      start_date: query.start_date || "",
      end_date: query.end_date || "",
    });
    setFilterError("");
    setFilterOpen(true);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) {
      setFilterError("End date must be on or after start date.");
      return;
    }
    setQuery((current) => ({ ...current, ...draft, page: 1 }));
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
                    <label>Start date
                      <input type="date" max="9999-12-31" value={draft.start_date} onChange={(event) => {
                        setDraft({ ...draft, start_date: event.target.value }); setFilterError("");
                      }} />
                    </label>
                    <label>End date
                      <input type="date" max="9999-12-31" value={draft.end_date} onChange={(event) => {
                        setDraft({ ...draft, end_date: event.target.value }); setFilterError("");
                      }} />
                    </label>
                  </div>
                  {filterError && <p role="alert" className="history-form-error">{filterError}</p>}
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

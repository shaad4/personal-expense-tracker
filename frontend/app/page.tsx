"use client";

import { useEffect, useState } from "react";
import ExpenseEditor from "../components/expense-editor";
import ExpenseHistory from "../components/expense-history";
import { Icon } from "../components/icons";
import MonthOverview from "../components/month-overview";
import ThemeSwitch from "../components/theme-switch";
import { api, type CategoryOption, type Expense, type SpendingSummary, type SummaryPeriod } from "../lib/api";
import { formatDate, monthLabel } from "../lib/format";
import { todayInKolkata } from "../lib/validation";

export default function Dashboard() {
  const [today, setToday] = useState("");
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [result, setResult] = useState<{ period: SummaryPeriod; day: string; data: SpendingSummary | null } | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const active = result?.period === period && result.day === today ? result : null;
  const summary = active?.data ?? null;
  const summaryError = active?.data === null;
  const [categoryError, setCategoryError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ expense: Expense | null } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const updateDate = () => setToday(todayInKolkata());
    updateDate();
    const timer = window.setInterval(updateDate, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api.getCategories(controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        setCategories(data);
        setCategoryError(false);
      }
    }).catch(() => { if (!controller.signal.aborted) setCategoryError(true); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!today) return;
    const controller = new AbortController();
    api.getSummary(period, controller.signal).then((data) => {
      if (!controller.signal.aborted) {
        const matchesPeriod = period === "today" ? "date" in data : "month" in data;
        setResult({ period, day: today, data: matchesPeriod ? data : null });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setResult({ period, day: today, data: null });
      }
    });
    return () => controller.abort();
  }, [period, today, revision, retry]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openEditor(expense: Expense | null) {
    if (!categories.length) {
      setNotice("Categories are unavailable. Check the backend connection and retry.");
      setRetry((value) => value + 1);
      return;
    }
    setNotice("");
    setEditor({ expense });
  }

  return (
    <>
      <a className="skip-link" href="#overview">Skip to overview</a>
      <header className="app-bar">
        <div className="frame bar-inner">
          <div className="brand"><img src="/icon.svg" width="34" height="34" alt="" />Folio</div>
          <span className="bar-divider" aria-hidden="true" />
          <span className="workspace-label">Personal ledger</span>
          <span className="today"><Icon name="calendar" size={16} />{today ? <time dateTime={today}>{formatDate(today)}</time> : "Today"}</span>
          <ThemeSwitch />
        </div>
      </header>
      <main id="overview" className="frame dashboard">
        <div className="overview-heading">
          <div>
            <h1 id="monthly-summary">{period === "today" ? "Today’s summary" : "Monthly summary"}</h1>
            <p>{period === "today" ? formatDate(summary && "date" in summary ? summary.date : today)
              : summary && "month" in summary ? monthLabel(summary.month) : "This month"}</p>
          </div>
          <button className="add-expense" type="button" onClick={() => openEditor(null)}><Icon name="plus" size={17} />Add expense</button>
        </div>
        <div className="summary-period" role="group" aria-label="Summary period">
          <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>This month</button>
          <button type="button" aria-pressed={period === "today"} onClick={() => setPeriod("today")}>Today</button>
        </div>
        {(summaryError || categoryError) && (
          <div className="connection-error" role="alert">
            <span>{summaryError ? "Couldn’t load your spending summary." : "Couldn’t load expense categories."} Check that the backend is running.</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        )}
        <MonthOverview period={period} summary={summary} failed={summaryError} />
        <ExpenseHistory categories={categories} revision={revision + retry} onEdit={openEditor} onAdd={() => openEditor(null)} />
      </main>
      {editor && <ExpenseEditor expense={editor.expense} categories={categories} onClose={() => setEditor(null)} onSaved={(message) => {
        setEditor(null);
        setRevision((value) => value + 1);
        setNotice(message);
      }} />}
      <div className="notices" role="status" aria-live="polite">
        {notice && <span className="notice">{notice}</span>}
      </div>
    </>
  );
}

import type { CSSProperties } from "react";
import type { SpendingSummary, SummaryPeriod } from "../lib/api";
import { formatMoney } from "../lib/format";
import { Icon } from "./icons";

function PaperFan() {
  return (
    <div className="paper-fan" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ "--leaf": i } as CSSProperties} />
      ))}
    </div>
  );
}

export default function SpendingOverview({ period, summary, failed }: {
  period: SummaryPeriod;
  summary: SpendingSummary | null;
  failed: boolean;
}) {
  const entries = summary?.by_category ?? [];
  const amount = summary ? formatMoney(summary.total) : "—";
  const [whole, fraction] = amount.split(".");
  const hasSpend = Boolean(summary?.expense_count);
  const interval = period === "today" ? "today" : "this month";
  const status = summary
    ? `${summary.expense_count} ${summary.expense_count === 1 ? "expense" : "expenses"} ${interval}`
    : failed ? `Total unavailable for ${interval}` : `Loading total for ${interval}…`;
  return (
    <section className="summary-grid" aria-label={`Spending ${interval}`} aria-busy={!summary && !failed}>
      <div className="spend-card">
        <PaperFan />
        <div className="spend-content">
          <h2 className="spend-label"><Icon name="wallet" size={18} /> Total spent</h2>
          <p className={`hero-amount${whole.length > 10 ? " long-amount" : ""}`}>
            {whole}{fraction && <span>.{fraction}</span>}
          </p>
          <div className="spend-foot">
            <span className="currency-tag">INR</span>
            <span>{status}</span>
          </div>
        </div>
      </div>
      <div className="breakdown-card">
        <h2>Category breakdown</h2>
        <div className={`allocation-track${hasSpend ? "" : " empty-track"}`} aria-hidden="true">
          {hasSpend && entries.filter(({ total }) => total !== "0.00").map(({ category, total }) => (
            <span key={category} className={`category-${category.toLowerCase()}`} style={{ flexGrow: Number(total) }} />
          ))}
        </div>
        {summary ? (
          <ul className="breakdown-legend">
            {entries.map(({ category, total }) => (
              <li key={category} className={`category-${category.toLowerCase()}`}>
                <span className="legend-name"><i />{category}</span>
                <span className="legend-amount">{formatMoney(total)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="summary-placeholder">{failed ? "Category totals unavailable." : "Loading categories…"}</p>}
      </div>
    </section>
  );
}

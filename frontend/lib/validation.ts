import type { CategoryOption, ExpenseInput } from "./api";

export type ExpenseDraft = Required<ExpenseInput>;
export type FieldErrors = Partial<Record<keyof ExpenseDraft, string>>;

export const expenseFields = ["title", "amount", "category", "date", "note"] as const;

export function todayInKolkata(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const { year, month, day } = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return [year, month, day].join("-");
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function currencyValue(raw: string): string | undefined {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)) return;
  const [whole, fraction = ""] = raw.split(".");
  const rupees = whole.replace(/^0+/, "") || "0";
  const paise = fraction.padEnd(2, "0");
  if (rupees.length > 8 || (rupees === "0" && paise === "00")) return;
  return rupees + "." + paise;
}

export function validateExpense(draft: ExpenseDraft, categories: CategoryOption[]) {
  const errors: FieldErrors = {};
  const title = draft.title.trim();
  const note = draft.note.replace(/\r\n?/g, "\n").trim();
  const amount = currencyValue(draft.amount.trim());

  if (!title) errors.title = "Enter a title.";
  else if (/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(draft.title)) {
    errors.title = "Use one line of plain text.";
  } else if ([...title].length > 200) errors.title = "Use 200 characters or fewer.";

  if (!amount) errors.amount = "Enter ₹0.01 to ₹9,99,99,999.99 with up to two decimal places.";
  if (!categories.some(({ value }) => value === draft.category)) errors.category = "Choose a category.";
  if (!isDateOnly(draft.date)) errors.date = "Choose a valid date.";
  if (/[\p{Cc}\p{Cs}]/u.test(draft.note.replace(/[\r\n\t]/g, ""))) {
    errors.note = "Use plain text, tabs, or line breaks.";
  } else if ([...note].length > 2000) errors.note = "Use 2,000 characters or fewer.";

  return { errors, data: { ...draft, title, amount: amount ?? "", note } };
}

export interface ExpenseInput {
  title: string;
  amount: string;
  category: string;
  date: string;
  note: string;
}

export interface Expense extends ExpenseInput {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryOption {
  value: string;
  label: string;
}

export interface ExpenseFilters {
  category?: string;
  title?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface ExpensePage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Expense[];
}

export type SummaryPeriod = "month" | "today";

export type SpendingSummary = ({ month: string } | { date: string }) & {
  currency: "INR";
  total: string;
  expense_count: number;
  by_category: { category: string; total: string }[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${path}`, {
      ...options,
      cache: "no-store",
      credentials: "omit",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Couldn’t reach the expense tracker. Check that the backend is running.", 0);
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const errors: Record<string, string[]> = Object.create(null);
    let message = "The request failed. Please try again.";
    if (payload && typeof payload === "object") {
      for (const [field, value] of Object.entries(payload)) {
        if (field === "detail" && typeof value === "string") message = value;
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
          errors[field] = value;
        }
      }
      if (errors.non_field_errors?.length) message = errors.non_field_errors.join(" ");
      else if (Object.keys(errors).length) message = "Please check the highlighted fields.";
    }
    throw new ApiError(message, response.status, errors);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

type CreateExpenseInput = Omit<ExpenseInput, "date" | "note"> & Partial<Pick<ExpenseInput, "date" | "note">>;

export const api = {
  listExpenses(filters: ExpenseFilters = {}, signal?: AbortSignal) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return request<ExpensePage>(`expenses/${query ? `?${query}` : ""}`, { signal });
  },
  getSummary: (period: SummaryPeriod, signal?: AbortSignal) =>
    request<SpendingSummary>(period === "today" ? "expenses/summary/?period=today" : "expenses/summary/", { signal }),
  getCategories: (signal?: AbortSignal) => request<CategoryOption[]>("expenses/categories/", { signal }),
  createExpense: (input: CreateExpenseInput) =>
    request<Expense>("expenses/", { method: "POST", body: JSON.stringify(input) }),
  updateExpense: (id: number, changes: Partial<ExpenseInput>) =>
    request<Expense>(`expenses/${id}/`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteExpense: (id: number) => request<void>(`expenses/${id}/`, { method: "DELETE" }),
};

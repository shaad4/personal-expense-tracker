"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, ApiError, type CategoryOption, type Expense, type ExpenseInput } from "../lib/api";
import { formatDate } from "../lib/format";
import { expenseFields, todayInKolkata, validateExpense, type ExpenseDraft, type FieldErrors } from "../lib/validation";
import DateInput from "./date-input";
import { Icon } from "./icons";
import "./expense-editor.css";

type Props = {
  expense: Expense | null;
  categories: CategoryOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function ExpenseEditor({ expense, categories, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ExpenseDraft>(() => ({
    title: expense?.title ?? "",
    amount: expense?.amount ?? "",
    category: expense?.category ?? "",
    date: formatDate(expense?.date ?? todayInKolkata()),
    note: expense?.note ?? "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sheet = dialog.current;
    const opener = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    sheet?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      sheet?.close();
      document.body.style.overflow = oldOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (confirmDelete) keepButton.current?.focus();
  }, [confirmDelete]);

  function leaveConfirmation() {
    setConfirmDelete(false);
    setErrorMessage("");
    requestAnimationFrame(() => deleteButton.current?.focus());
  }

  function dismiss() {
    if (locked.current) return;
    if (confirmDelete) leaveConfirmation();
    else onClose();
  }

  function changeField(name: keyof ExpenseDraft, value: string) {
    setDraft(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined }));
    setErrorMessage("");
  }

  function fieldProps(name: keyof ExpenseDraft) {
    return {
      name, id: "expense-" + name, value: draft[name],
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? "expense-" + name + "-error" : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        changeField(name, event.target.value);
      },
    };
  }

  function fieldError(name: keyof ExpenseDraft) {
    return errors[name] && <span id={`expense-${name}-error`} className="expense-field-error">{errors[name]}</span>;
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    const first = expenseFields.find(name => next[name]);
    if (first) requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const { errors: clientErrors, data } = validateExpense(draft, categories);
    if (!confirmDelete && Object.keys(clientErrors).length) {
      showFieldErrors(clientErrors);
      return;
    }
    locked.current = true;
    setBusy(true);
    setErrorMessage("");
    try {
      if (confirmDelete && expense) {
        await api.deleteExpense(expense.id);
        onSaved("Expense deleted.");
      } else if (expense) {
        const changes: Partial<ExpenseInput> = {};
        for (const field of expenseFields) {
          if (data[field] !== expense[field]) changes[field] = data[field];
        }
        if (!Object.keys(changes).length) {
          onClose();
          return;
        }
        await api.updateExpense(expense.id, changes);
        onSaved("Changes saved.");
      } else {
        await api.createExpense(data);
        onSaved("Expense added.");
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors: FieldErrors = {};
        for (const field of expenseFields) {
          const message = error.errors[field]?.[0];
          if (message) fieldErrors[field] = message;
        }
        if (!confirmDelete && Object.keys(fieldErrors).length) showFieldErrors(fieldErrors);
        else setErrorMessage(error.message);
      } else {
        setErrorMessage("Couldn’t reach the tracker. Check the connection and try again.");
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="expense-sheet" aria-labelledby="expense-sheet-title"
      onCancel={event => { event.preventDefault(); dismiss(); }}>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <header className="expense-sheet-head">
          <h2 id="expense-sheet-title">{confirmDelete ? "Delete expense?" : expense ? "Edit expense" : "Add expense"}</h2>
          <button className="expense-sheet-close" type="button" onClick={dismiss} disabled={busy} aria-label="Close dialog">
            <Icon name="x" size={17} />
          </button>
        </header>

        {confirmDelete ? (
          <p className="expense-delete-copy">“{expense?.title}” will be permanently removed from your expenses.</p>
        ) : (
          <fieldset className="expense-sheet-fields" disabled={busy}>
            <div className="expense-form-field">
              <label htmlFor="expense-title">Title</label>
              <input {...fieldProps("title")} type="text" placeholder="e.g. Lunch at the café" autoFocus required autoComplete="off" />
              {fieldError("title")}
            </div>
            <div className="expense-form-row">
              <div className="expense-form-field">
                <label htmlFor="expense-amount">Amount</label>
                <div className="expense-amount-input">
                  <span aria-hidden="true">₹</span>
                  <input {...fieldProps("amount")} inputMode="decimal" type="text" placeholder="0.00" required autoComplete="off" />
                </div>
                {fieldError("amount")}
              </div>
              <div className="expense-form-field">
                <label htmlFor="expense-date">Date</label>
                <DateInput id="expense-date" name="date" value={draft.date} required
                  calendarLabel="Choose expense date from calendar"
                  aria-invalid={!!errors.date} aria-describedby={errors.date ? "expense-date-error" : undefined}
                  onValueChange={(value) => changeField("date", value)} />
                {fieldError("date")}
              </div>
            </div>
            <div className="expense-form-field">
              <label htmlFor="expense-category">Category</label>
              <div className="expense-category-select">
                <select {...fieldProps("category")} required>
                  <option value="" disabled>Choose a category</option>
                  {categories.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Icon name="chevron-down" size={16} />
              </div>
              {fieldError("category")}
            </div>
            <div className="expense-form-field">
              <label htmlFor="expense-note">Note <span className="expense-optional">Optional</span></label>
              <textarea {...fieldProps("note")} rows={3} placeholder="Add a note…" />
              {fieldError("note")}
            </div>
          </fieldset>
        )}

        {errorMessage && <p className="expense-request-error" role="alert">{errorMessage}</p>}
        <footer className="expense-sheet-actions">
          {expense && !confirmDelete && (
            <button ref={deleteButton} type="button" className="expense-action-delete" onClick={() => {
              setErrorMessage("");
              setConfirmDelete(true);
            }} disabled={busy}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <button ref={keepButton} type="button" className="expense-action-secondary" onClick={dismiss} disabled={busy}>
            {confirmDelete ? "Keep expense" : "Cancel"}
          </button>
          <button type="submit" className={confirmDelete ? "expense-action-danger" : "expense-action-primary"} disabled={busy}>
            {confirmDelete ? (busy ? "Deleting…" : "Delete expense") : busy ? "Saving…" : expense ? "Save changes" : "Add expense"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

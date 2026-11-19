const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const monthYear = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMoney(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  // Formatting the whole part separately keeps totals above Number.MAX_SAFE_INTEGER exact.
  return `${rupees.format(BigInt(whole))}.${fraction.padEnd(2, "0")}`;
}

export function monthLabel(month: string): string {
  return monthYear.format(new Date(`${month}-01T00:00:00Z`));
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

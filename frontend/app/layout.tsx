import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeStorageKey } from "../lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio | personal expense tracker",
  description: "Your personal expense ledger and monthly spending overview.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Apply the saved choice before the first paint. CSS follows the system by default.
  const restoreTheme = `try {
    const choice = localStorage.getItem(${JSON.stringify(themeStorageKey)});
    if (choice === "dark" || choice === "light") document.documentElement.dataset.theme = choice;
  } catch {}`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script>{restoreTheme}</script></head>
      <body>{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";

const paths = {
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  sliders: <><path d="M3 7h6m4 0h8M3 17h10m4 0h4" /><circle cx="11" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  receipt: <><path d="M5 3.5 7 5l2.5-1.5L12 5l2.5-1.5L17 5l2-1.5v17L17 19l-2.5 1.5L12 19l-2.5 1.5L7 19l-2 1.5z" /><path d="M9 9h6m-6 4h4" /></>,
  calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="3" /><path d="M7.5 3.5v4m9-4v4M4 10.5h16" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  edit: <><path d="m14 5 5 5M4 20l5-1 12-12a2 2 0 0 0-5-5L4 15z" /></>,
  trash: <><path d="M3.5 6.5h17m-12-3h7m-10 3 .9 13a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1l.9-13M10 10v6m4-6v6" /></>,
  food: <><path d="M4.5 3.5v5a3 3 0 0 0 6 0v-5m-3 0v17M18.5 3.5c-2.6 2-3.7 5.1-3.7 8.5h3.7m0-8.5v17" /></>,
  transport: <><rect x="5" y="3.5" width="14" height="15" rx="3" /><path d="M5 11.5h14m-7-8v8M8.5 18.5l-2 3m9-3 2 3M8.5 15h1m5 0h1" /></>,
  shopping: <><path d="M5 8h14l1 12H4zM9 9V7a3 3 0 0 1 6 0v2" /></>,
  bills: <><path d="M6 3.5h9l3.5 3.7V21L16 19.5 13.5 21 11 19.5 8.5 21 6 19.5zM14 4v4h4M9 11h6m-6 4h4" /></>,
  entertainment: <><path d="m3 10 14-6 3.2 7.4-1.4.6a2 2 0 0 0 1.6 3.7l-14 6L3 14.3a2.3 2.3 0 0 0 0-4.3Z" /><path d="m13 8 .5 1.3m1 2 .5 1.3m1 2 .5 1.3" /></>,
  other: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  wallet: <><path d="M3.5 8V6a2 2 0 0 1 2-2h12v4" /><rect x="3.5" y="8" width="17" height="12" rx="2.5" /><path d="M16 13.8h1" /></>,
} satisfies Record<string, ReactNode>;

export function Icon({ name, size = 18, className }: {
  name: keyof typeof paths; size?: number; className?: string;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

const categoryIcons = {
  Food: "food", Transport: "transport", Shopping: "shopping",
  Bills: "bills", Entertainment: "entertainment", Other: "other",
} as const;

export function CategoryIcon({ category, size = 17 }: {category: string; size?: number}) {
  const name = categoryIcons[category as keyof typeof categoryIcons] ?? "other";
  return <span className={`category-icon category-${name}`}><Icon name={name} size={size} /></span>;
}

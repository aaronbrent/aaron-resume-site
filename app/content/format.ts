import type { Planet } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2024-06" → "Jun 2024"; "present" → "Present". */
export function formatYearMonth(value: string): string {
  if (value === "present") return "Present";
  const [year, month] = value.split("-");
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : value;
}

/** "Jun 2024 — May 2026" */
export function formatPeriod(period: Planet["period"]): string {
  return `${formatYearMonth(period.start)} — ${formatYearMonth(period.end)}`;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Converts a Date to BMS's YYYYMMDD query format. */
export function toApiDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

/** Parses a YYYYMMDD string back into a Date. */
export function fromApiDate(date: string): Date {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(4, 6))
  const day = Number(date.slice(6, 8))
  return new Date(year, month - 1, day)
}

/** Formats a YYYYMMDD string for display, e.g. "Mon, Jul 27, 2026". */
export function formatApiDate(date?: string) {
  if (!date || date.length !== 8) return date
  return fromApiDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** Splits a raw showtime label like "10:00 PM, LASER" into time + format tag. */
export function parseShowtime(raw: string): { time: string; tag: string | null } {
  const idx = raw.indexOf(",")
  if (idx === -1) return { time: raw.trim(), tag: null }
  return { time: raw.slice(0, idx).trim(), tag: raw.slice(idx + 1).trim() }
}

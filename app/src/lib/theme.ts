export type Theme = "light" | "dark"

const STORAGE_KEY = "bms-tracker:theme"

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === "light" || stored === "dark" ? stored : systemTheme()
}

export function hasStoredTheme(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function storeTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
}

export { systemTheme }

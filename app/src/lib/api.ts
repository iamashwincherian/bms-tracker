// In local dev, VITE_API_BASE_URL points at the separately-running backend
// (see app/.env). In production the frontend is served by the same FastAPI
// app it's calling (see main.py's static mount), so it's unset and this
// falls back to same-origin - no CORS, no per-deploy config needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin
const API_PREFIX = "/api"

export interface MovieResult {
  name: string
  id: string
  slug: string
  poster: string | null
  language: string | null
}

export interface Theatre {
  name: string
  showtimes: string[]
}

export interface City {
  name: string
  code: string
  slug: string
  aliases: string[]
  popular: boolean
}

export interface Cinema {
  name: string
  address: string
}

export interface ShowsResult {
  success: boolean
  message: string
  show_available: boolean
  title?: string
  date?: string
  city?: string
  theatre_filter?: string
  theatres?: Theatre[]
}

export type TrackedShowStatus = "pending" | "available" | "expired"

export interface TrackedShow {
  id: number
  movie_id: string
  movie_name: string
  movie_slug: string
  movie_poster: string | null
  city_name: string
  city_code: string
  city_slug: string
  date: string
  theatre: string | null
  notify_email: string
  status: TrackedShowStatus
  created_at: string
  last_checked_at: string | null
  notified_at: string | null
}

export interface TrackedShowCreate {
  movie_id: string
  movie_name: string
  movie_slug: string
  movie_poster: string | null
  city_name: string
  city_code: string
  city_slug: string
  date: string
  theatre: string | null
  notify_email: string
}

export type WorkerLogOutcome = "available" | "not_available" | "error"

export interface WorkerLog {
  id: number
  tracked_show_id: number | null
  movie_name: string
  city_name: string
  date: string
  theatre: string | null
  outcome: WorkerLogOutcome
  message: string | null
  duration_ms: number | null
  checked_at: string
}

export class ApiError extends Error { }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(API_PREFIX + path, API_BASE_URL)

  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new ApiError("Could not reach the Movie Radar API. Is the backend running?")
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function getJson<T>(path: string, params: Record<string, string | undefined>, signal?: AbortSignal): Promise<T> {
  const url = new URL(path, API_BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return request<T>(url.pathname + url.search, { signal })
}

export async function searchMovies(query: string, cityCode: string, signal?: AbortSignal): Promise<MovieResult[]> {
  const data = await getJson<MovieResult[] | null | { success: false; error: string }>(
    "/movies",
    { query, city: cityCode },
    signal,
  )
  if (!data || !Array.isArray(data)) return []
  return data
}

let citiesPromise: Promise<City[]> | null = null

export function fetchCities(): Promise<City[]> {
  if (!citiesPromise) {
    citiesPromise = getJson<City[]>("/cities", {}).catch((err) => {
      citiesPromise = null
      throw err
    })
  }
  return citiesPromise
}

const cinemasPromises = new Map<string, Promise<Cinema[]>>()

export function fetchCinemas(citySlug: string): Promise<Cinema[]> {
  let promise = cinemasPromises.get(citySlug)
  if (!promise) {
    promise = getJson<Cinema[]>("/cinemas", { city: citySlug }).catch((err) => {
      cinemasPromises.delete(citySlug)
      throw err
    })
    cinemasPromises.set(citySlug, promise)
  }
  return promise
}

export async function fetchShows(params: {
  city: string
  movie: string
  movieId: string
  date: string
  theatre?: string
}, signal?: AbortSignal): Promise<ShowsResult> {
  return getJson<ShowsResult>(
    "/shows",
    {
      city: params.city,
      movie: params.movie,
      movie_id: params.movieId,
      date: params.date,
      theatre: params.theatre,
    },
    signal,
  )
}

export function listTrackedShows(signal?: AbortSignal): Promise<TrackedShow[]> {
  return request<TrackedShow[]>("/tracked", { signal })
}

export function createTrackedShow(payload: TrackedShowCreate, signal?: AbortSignal): Promise<TrackedShow> {
  return request<TrackedShow>("/tracked", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  })
}

export function deleteTrackedShow(id: number, signal?: AbortSignal): Promise<void> {
  return request<void>(`/tracked/${id}`, { method: "DELETE", signal })
}

export function listWorkerLogs(signal?: AbortSignal): Promise<WorkerLog[]> {
  return getJson<WorkerLog[]>("/logs", {}, signal)
}

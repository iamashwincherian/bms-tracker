import { useEffect, useState } from "react"
import { BellIcon, MoonIcon, ScrollTextIcon, SunIcon } from "lucide-react"
import { Link } from "react-router-dom"

import {
  deleteTrackedShow,
  fetchCities,
  fetchShows,
  listTrackedShows,
  searchMovies,
  type City,
  type MovieResult,
  type ShowsResult,
  type TrackedShow,
} from "@/lib/api"
import { fromApiDate, toApiDate } from "@/lib/utils"
import { applyTheme, getInitialTheme, hasStoredTheme, storeTheme, systemTheme, type Theme } from "@/lib/theme"
import { AlertsDrawer, type DrawerTarget } from "@/components/AlertsDrawer"
import { SearchBar } from "@/components/SearchBar"
import { ShowResults } from "@/components/ShowResults"

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const [movieText, setMovieText] = useState("")
  const [selectedMovie, setSelectedMovie] = useState<MovieResult | null>(null)
  const [cityText, setCityText] = useState("")
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [date, setDate] = useState<Date>(new Date())

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShowsResult | null>(null)
  const [resultMovie, setResultMovie] = useState<MovieResult | null>(null)
  const [resultCity, setResultCity] = useState<City | null>(null)
  const [resultDate, setResultDate] = useState("")

  const [trackedShows, setTrackedShows] = useState<TrackedShow[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerCreating, setDrawerCreating] = useState(false)
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null)

  const canSubmit = movieText.trim().length > 0 && cityText.trim().length > 0 && !loading

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (!hasStoredTheme()) setTheme(systemTheme())
    }
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    storeTheme(next)
  }

  async function refreshTrackedShows() {
    try {
      setTrackedShows(await listTrackedShows())
    } catch {
      // Leave the previous list in place; the drawer stays usable offline.
    }
  }

  useEffect(() => {
    refreshTrackedShows()
  }, [])

  async function handleSubmit() {
    if (!canSubmit) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let city = selectedCity
      if (!city || city.name !== cityText) {
        const query = cityText.trim().toLowerCase()
        const cities = await fetchCities()
        city =
          cities.find((c) => c.name.toLowerCase() === query) ??
          cities.find((c) => c.name.toLowerCase().includes(query) || c.aliases.some((a) => a.toLowerCase().includes(query))) ??
          null
        if (!city) {
          setError(`No city found matching "${cityText.trim()}". Try a different name.`)
          return
        }
        setSelectedCity(city)
      }

      let movie = selectedMovie
      if (!movie || movie.name !== movieText) {
        const matches = await searchMovies(movieText.trim(), city.code)
        if (matches.length === 0) {
          setError(`No movie found matching "${movieText.trim()}". Try a different name.`)
          return
        }
        movie = matches[0]
        setSelectedMovie(movie)
      }

      const apiDate = toApiDate(date)
      const shows = await fetchShows({
        city: city.slug,
        movie: movie.slug,
        movieId: movie.id,
        date: apiDate,
      })
      setResult(shows)
      setResultMovie(movie)
      setResultCity(city)
      setResultDate(apiDate)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenTrack() {
    if (!resultMovie || !resultCity) return
    setDrawerTarget({ movie: resultMovie, city: resultCity, date: resultDate })
    setDrawerCreating(true)
    setDrawerOpen(true)
  }

  function handleOpenAlerts() {
    setDrawerCreating(false)
    setDrawerTarget(null)
    refreshTrackedShows()
    setDrawerOpen(true)
  }

  function handleTracked() {
    refreshTrackedShows()
    setDrawerCreating(false)
  }

  function handleCheckTracked(show: TrackedShow) {
    setMovieText(show.movie_name)
    setSelectedMovie({
      name: show.movie_name,
      id: show.movie_id,
      slug: show.movie_slug,
      poster: show.movie_poster,
      language: null,
    })
    setCityText(show.city_name)
    setSelectedCity({
      name: show.city_name,
      code: show.city_code,
      slug: show.city_slug,
      aliases: [],
      popular: false,
    })
    setDate(fromApiDate(show.date))
    setResult(null)
    setError(null)
    setDrawerOpen(false)
  }

  async function handleRemoveTracked(id: number) {
    setTrackedShows((shows) => shows.filter((s) => s.id !== id))
    try {
      await deleteTrackedShow(id)
    } catch {
      refreshTrackedShows()
    }
  }

  return (
    <div className="min-h-svh w-full">
      <div className="mx-auto max-w-220 px-6 pt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-primary">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            </svg>
            <span className="font-display text-xl font-bold tracking-tight">Movie Radar</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/logs"
              aria-label="Worker logs"
              className="flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border"
            >
              <ScrollTextIcon className="size-4" />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border"
            >
              {theme === "dark" ? <SunIcon className="size-4.25" /> : <MoonIcon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={handleOpenAlerts}
              aria-label="Your alerts"
              className="relative flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border"
            >
              <BellIcon className="size-4.5" />
              {trackedShows.length > 0 && (
                <span className="absolute -top-0.75 -right-0.75 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-extrabold text-primary-foreground">
                  {trackedShows.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-220 px-6 pt-13">
        <h1 className="font-display mb-2.5 text-4xl font-bold tracking-tight text-balance">Find your next show.</h1>
        <p className="mb-7 max-w-115 text-[15px] text-muted-foreground">
          Search a movie, pick your city and date &mdash; we'll keep watching for tickets even when there's nothing
          on sale yet.
        </p>

        <div className="max-w-170">
          <SearchBar
            movieText={movieText}
            cityText={cityText}
            cityCode={selectedCity?.code ?? ""}
            date={date}
            canSubmit={canSubmit}
            loading={loading}
            onMovieChange={(value, movie) => {
              setMovieText(value)
              setSelectedMovie(movie)
              if (!value) {
                setResult(null)
                setError(null)
                setResultMovie(null)
                setResultCity(null)
                setResultDate("")
              }
            }}
            onCityChange={(value, city) => {
              setCityText(value)
              setSelectedCity(city)
            }}
            onDateChange={setDate}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <div className="mx-auto max-w-220 px-6 pt-9 pb-11">
        <ShowResults
          loading={loading}
          error={error}
          result={result}
          movie={resultMovie}
          city={resultCity}
          date={resultDate}
          onTrackClick={handleOpenTrack}
        />
      </div>

      <div className="mx-auto max-w-220 px-6 pb-8 text-center">
        <p className="text-[12.5px] text-muted-foreground/60">Movie Radar &middot; by Ashwin Cherian Joseph</p>
      </div>

      <AlertsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        creating={drawerCreating}
        target={drawerTarget}
        shows={trackedShows}
        onRemove={handleRemoveTracked}
        onCheck={handleCheckTracked}
        onTracked={handleTracked}
      />
    </div>
  )
}

export default App

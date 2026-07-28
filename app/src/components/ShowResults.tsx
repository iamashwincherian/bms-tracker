import { useEffect, useState } from "react"
import { AlertCircleIcon, BellIcon, BellOffIcon, MapPinIcon } from "lucide-react"

import type { City, MovieResult, ShowsResult } from "@/lib/api"
import { fetchCinemas } from "@/lib/api"
import { formatApiDate, parseShowtime } from "@/lib/utils"
import { MoviePoster } from "@/components/MoviePoster"
import { Separator } from "@/components/ui/separator"

interface ShowResultsProps {
  loading: boolean
  error: string | null
  result: ShowsResult | null
  movie: MovieResult | null
  city: City | null
  date: string
  onTrackClick: () => void
}

function ShimmerBlock({ className }: { className: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

export function ShowResults({ loading, error, result, movie, city, date, onTrackClick }: ShowResultsProps) {
  const [addresses, setAddresses] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!city || !result?.success) return
    fetchCinemas(city.slug)
      .then((cinemas) => {
        const map: Record<string, string> = {}
        for (const c of cinemas) map[c.name] = c.address
        setAddresses(map)
      })
      .catch(() => { })
  }, [city, result])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex gap-4">
          <ShimmerBlock className="h-22 w-16 shrink-0 rounded-xl" />
          <div className="flex-1 pt-2">
            <ShimmerBlock className="mb-2.5 h-4.5 w-3/5" />
            <ShimmerBlock className="h-3 w-2/5" />
          </div>
        </div>
        <ShimmerBlock className="mb-3 h-11 w-full" />
        <ShimmerBlock className="h-11 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">Something went wrong</p>
          <p className="mt-0.5 text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return <p className="text-[13.5px] text-muted-foreground/70">
      Search a movie above and hit find to see showtimes.
    </p>
  }

  if (!result.success || !result.theatres?.length) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-13 text-center">
        <BellOffIcon className="mx-auto mb-4 size-8 text-muted-foreground/40" strokeWidth={1.6} />
        <p className="font-display mb-1 text-[17px] font-bold">No shows scheduled yet</p>
        <p className="mx-auto mb-5 max-w-xs text-[13.5px] text-muted-foreground">
          We checked {city?.name} for {formatApiDate(date)} &mdash; nothing's on sale. We can watch it for you.
        </p>
        {movie && city && (
          <button
            type="button"
            onClick={onTrackClick}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            <BellIcon className="size-3.75" />
            Track this show
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-4">
        <MoviePoster src={movie?.poster ?? null} className="h-22 w-16 rounded-xl" iconClassName="size-5" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[21px] font-bold">{movie?.name ?? result.title}</p>
          <p className="text-[13px] text-muted-foreground">
            {result.city} &middot; {formatApiDate(result.date)}
          </p>
        </div>
      </div>

      {result.theatres.map((theatre, idx) => (
        <div key={theatre.name} className="mb-4">
          {idx > 0 && <Separator className="mb-2.5" />}
          <div className="flex items-start gap-2.5 py-1.5 pb-3">
            <MapPinIcon className="mt-0.5 size-3.75 shrink-0 text-brand" strokeWidth={2.2} />
            <div className="min-w-0">
              <p className="text-[14.5px] font-bold text-pretty">{theatre.name}</p>
              {addresses[theatre.name] && (
                <p className="text-xs text-pretty text-muted-foreground">{addresses[theatre.name]}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1 pl-6.25">
            {theatre.showtimes.length > 0 ? (
              theatre.showtimes.map((raw) => {
                const { time, tag } = parseShowtime(raw)
                return (
                  <div
                    key={raw}
                    className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-[12.5px] font-semibold"
                  >
                    {time}
                    {tag && (
                      <span className="rounded-[5px] bg-brand-soft px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide text-brand">
                        {tag}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <span className="text-sm text-muted-foreground">No showtimes listed</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

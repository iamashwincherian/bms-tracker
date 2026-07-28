import { CheckCircle2Icon, ClockIcon, SearchIcon, Trash2Icon } from "lucide-react"

import type { TrackedShow } from "@/lib/api"
import { formatApiDate } from "@/lib/utils"
import { MoviePoster } from "@/components/MoviePoster"
import { Badge } from "@/components/ui/badge"

interface TrackedListProps {
  shows: TrackedShow[]
  onRemove: (id: number) => void
  onCheck: (show: TrackedShow) => void
}

function StatusBadge({ status }: { status: TrackedShow["status"] }) {
  if (status === "available") {
    return (
      <Badge className="shrink-0 gap-1 bg-green-600 text-white hover:bg-green-600/90 dark:bg-green-500">
        <CheckCircle2Icon className="size-3" />
        Available
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
        Expired
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0 gap-1">
      <ClockIcon className="size-3" />
      Watching
    </Badge>
  )
}

export function TrackedList({ shows, onRemove, onCheck }: TrackedListProps) {
  if (shows.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-muted-foreground/60">
        <p className="text-[13.5px]">No alerts yet. Search a movie and tap &ldquo;Track this show&rdquo;.</p>
      </div>
    )
  }

  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((show) => (
        <div key={show.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-muted p-3.5">
          <MoviePoster src={show.movie_poster} className="h-16 w-12 rounded-md" iconClassName="size-4" />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <p className="truncate text-sm font-bold">{show.movie_name}</p>
              <StatusBadge status={show.status} />
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              {show.city_name} &middot; {formatApiDate(show.date)}
            </p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {show.theatre ?? `Any theatre in ${show.city_name}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              aria-label="Check now"
              onClick={() => onCheck(show)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] border-border text-foreground"
            >
              <SearchIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onRemove(show.id)}
              className="flex size-8 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] border-border text-muted-foreground"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

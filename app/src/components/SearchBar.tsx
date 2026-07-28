import { useState } from "react"
import { ArrowRightIcon, CalendarIcon, SearchIcon } from "lucide-react"

import type { City, MovieResult } from "@/lib/api"
import { CityCombobox } from "@/components/CityCombobox"
import { MovieCombobox } from "@/components/MovieCombobox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface SearchBarProps {
  movieText: string
  cityText: string
  cityCode: string
  date: Date
  canSubmit: boolean
  loading: boolean
  onMovieChange: (value: string, movie: MovieResult | null) => void
  onCityChange: (value: string, city: City | null) => void
  onDateChange: (date: Date) => void
  onSubmit: () => void
}

export function SearchBar({
  movieText,
  cityText,
  cityCode,
  date,
  canSubmit,
  loading,
  onMovieChange,
  onCityChange,
  onDateChange,
  onSubmit,
}: SearchBarProps) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit()
      }}
      className="flex flex-col gap-1.5 rounded-[18px] border border-border bg-card p-1.5 shadow-xs sm:flex-row sm:items-center sm:gap-0.5"
    >
      <div className="flex flex-1 items-center">
        <SearchIcon className="ml-2 size-4.25 shrink-0 text-muted-foreground" />
        <MovieCombobox value={movieText} city={cityCode} onValueChange={onMovieChange} />
      </div>

      <div className="hidden h-6 w-px shrink-0 bg-border sm:block" />

      <div className="flex items-center gap-0.5 sm:contents">
        <CityCombobox value={cityText} onValueChange={onCityChange} className="sm:w-35" />
        <div className="h-6 w-px shrink-0 bg-border" />
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-accent sm:px-6"
            >
              <CalendarIcon className="size-3.75 text-muted-foreground" />
              {date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              defaultMonth={date}
              onSelect={(selected) => {
                if (!selected) return
                onDateChange(selected)
                setDatePopoverOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Find shows"
          className="flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-[13px] bg-primary text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRightIcon className={loading ? "size-4.25 animate-pulse" : "size-4.25"} />
        </button>
      </div>
    </form>
  )
}

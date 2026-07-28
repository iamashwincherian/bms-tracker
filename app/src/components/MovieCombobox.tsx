import { useEffect, useRef, useState } from "react"
import { Loader2Icon, XIcon } from "lucide-react"

import { searchMovies, type MovieResult } from "@/lib/api"
import { cn } from "@/lib/utils"
import { MoviePoster } from "@/components/MoviePoster"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

interface MovieComboboxProps {
  value: string
  city: string
  onValueChange: (value: string, movie: MovieResult | null) => void
  className?: string
}

export function MovieCombobox({ value, city, onValueChange, className }: MovieComboboxProps) {
  const [suggestions, setSuggestions] = useState<MovieResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const skipNextSearchRef = useRef(false)
  const cityRef = useRef(city)
  cityRef.current = city
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

    const query = value.trim()
    if (query.length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)

    const timer = setTimeout(() => {
      searchMovies(query, cityRef.current, controller.signal)
        .then((results) => {
          setSuggestions(results)
          setOpen(true)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setSuggestions([])
        })
        .finally(() => setLoading(false))
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // Deliberately excludes `city`: changing city alone shouldn't re-trigger
    // (and reopen) a search for the movie text that's already settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative flex-1">
          <Input
            ref={inputRef}
            placeholder="Search any movie…"
            value={value}
            onChange={(e) => onValueChange(e.target.value, null)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            className={cn(
              "h-auto border-0 bg-transparent dark:bg-transparent px-2 py-3 text-[15.5px] shadow-none focus-visible:ring-0",
              value && "pr-8",
              className,
            )}
          />
          {loading && (
            <Loader2Icon className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {!loading && value && (
            <button
              type="button"
              aria-label="Clear movie"
              onClick={() => {
                skipNextSearchRef.current = true
                setSuggestions([])
                setOpen(false)
                onValueChange("", null)
                inputRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </PopoverAnchor>
  <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // The anchor input opens this popover on focus/click; without this
          // guard, Radix's dismissable layer treats that same click's mouseup
          // as an "outside" interaction (the input lives outside the portaled
          // content) and immediately closes what was just opened.
          if (anchorRef.current?.contains(e.target as Node)) {
            e.preventDefault()
          }
        }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>No movies found.</CommandEmpty>
            <CommandGroup>
              {suggestions.map((movie) => (
                <CommandItem
                  key={movie.id}
                  value={movie.id}
                  onSelect={() => {
                    skipNextSearchRef.current = true
                    setSuggestions([])
                    onValueChange(movie.name, movie)
                    setOpen(false)
                  }}
                  className="gap-2"
                >
                  <MoviePoster src={movie.poster} className="size-8 rounded-sm" iconClassName="size-4" />
                  <div className="min-w-0">
                    <p className="truncate">{movie.name}</p>
                    {movie.language && (
                      <p className="truncate text-xs text-muted-foreground">{movie.language}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

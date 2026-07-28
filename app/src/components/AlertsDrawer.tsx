import { useEffect, useState } from "react"
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon } from "lucide-react"

import type { Cinema, City, MovieResult, TrackedShow } from "@/lib/api"
import { createTrackedShow, fetchCinemas } from "@/lib/api"
import { formatApiDate } from "@/lib/utils"
import { MoviePoster } from "@/components/MoviePoster"
import { TrackedList } from "@/components/TrackedList"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const LAST_EMAIL_KEY = "bms-tracker:last-email"
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

export interface DrawerTarget {
  movie: MovieResult
  city: City
  date: string
}

interface AlertsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creating: boolean
  target: DrawerTarget | null
  shows: TrackedShow[]
  onRemove: (id: number) => void
  onCheck: (show: TrackedShow) => void
  onTracked: () => void
}

export function AlertsDrawer({ open, onOpenChange, creating, target, shows, onRemove, onCheck, onTracked }: AlertsDrawerProps) {
  const [cinemas, setCinemas] = useState<Cinema[] | null>(null)
  const [cinemasError, setCinemasError] = useState<string | null>(null)
  const [selectedTheatre, setSelectedTheatre] = useState<string | null>(null)
  const [theatrePopoverOpen, setTheatrePopoverOpen] = useState(false)
  const [email, setEmail] = useState(() => localStorage.getItem(LAST_EMAIL_KEY) ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const emailValid = EMAIL_PATTERN.test(email.trim())

  useEffect(() => {
    if (!open || !creating || !target || cinemas) return
    setCinemasError(null)
    fetchCinemas(target.city.slug)
      .then(setCinemas)
      .catch(() => setCinemasError("Couldn't load theatres for this city. You can still track \"any theatre\"."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, creating, target])

  useEffect(() => {
    if (!open) {
      setCinemas(null)
      setSelectedTheatre(null)
      setTheatrePopoverOpen(false)
      setSubmitError(null)
    }
  }, [open])

  async function handleSubmit() {
    if (!target || !emailValid || submitting) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      await createTrackedShow({
        movie_id: target.movie.id,
        movie_name: target.movie.name,
        movie_slug: target.movie.slug,
        movie_poster: target.movie.poster,
        city_name: target.city.name,
        city_code: target.city.code,
        city_slug: target.city.slug,
        date: target.date,
        theatre: selectedTheatre,
        notify_email: email.trim(),
      })
      localStorage.setItem(LAST_EMAIL_KEY, email.trim())
      setSelectedTheatre(null)
      onTracked()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to track this show.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-6 sm:max-w-[400px]">
        <SheetHeader className="mb-1 p-0">
          <SheetTitle className="font-display text-[19px]">Your Alerts</SheetTitle>
        </SheetHeader>

        {creating && target && (
          <div className="mt-5 rounded-2xl border border-border bg-muted p-4.5">
            <div className="mb-4 flex items-center gap-3">
              <MoviePoster src={target.movie.poster} className="h-15 w-11 rounded-md" iconClassName="size-4" />
              <div>
                <p className="font-display text-[15px] font-bold">{target.movie.name}</p>
                <p className="text-xs text-muted-foreground">
                  {target.city.name} &middot; {formatApiDate(target.date)}
                </p>
              </div>
            </div>

            <Popover open={theatrePopoverOpen} onOpenChange={setTheatrePopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mb-3.5 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-[13px] font-semibold"
                >
                  <span className="truncate">{selectedTheatre ?? `Any theatre in ${target.city.name}`}</span>
                  <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput placeholder={`Search theatres in ${target.city.name}...`} />
                  <CommandList className="max-h-56">
                    {cinemas === null && !cinemasError && (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2Icon className="size-4 animate-spin" />
                        Loading theatres...
                      </div>
                    )}
                    {cinemasError && (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">{cinemasError}</div>
                    )}
                    {cinemas && (
                      <>
                        <CommandEmpty>No matching theatres found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value={`any theatre in ${target.city.name}`}
                            onSelect={() => {
                              setSelectedTheatre(null)
                              setTheatrePopoverOpen(false)
                            }}
                          >
                            <CheckIcon className={selectedTheatre === null ? "opacity-100" : "opacity-0"} />
                            Any theatre in {target.city.name}
                          </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                          {cinemas.map((cinema) => (
                            <CommandItem
                              key={cinema.name}
                              value={cinema.name}
                              onSelect={() => {
                                setSelectedTheatre(cinema.name)
                                setTheatrePopoverOpen(false)
                              }}
                            >
                              <CheckIcon className={selectedTheatre === cinema.name ? "opacity-100" : "opacity-0"} />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-bold">{cinema.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{cinema.address}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="mb-3.5 space-y-1.5">
              <Label htmlFor="track-email" className="sr-only">
                Notify email
              </Label>
              <Input
                id="track-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background"
              />
              {submitError && <p className="text-xs text-destructive">{submitError}</p>}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!emailValid || submitting}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[11px] bg-primary py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {submitting && <Loader2Icon className="size-4 animate-spin" />}
              Create Alert
            </button>
          </div>
        )}

        <div className="mt-5">
          <TrackedList shows={shows} onRemove={onRemove} onCheck={onCheck} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

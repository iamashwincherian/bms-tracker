import { useEffect, useRef, useState } from "react"
import { Loader2Icon } from "lucide-react"

import { fetchCities, type City } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"

interface CityComboboxProps {
  value: string
  onValueChange: (value: string, city: City | null) => void
  className?: string
}

const MAX_SUGGESTIONS = 20

function matches(city: City, query: string) {
  const q = query.toLowerCase()
  return city.name.toLowerCase().includes(q) || city.aliases.some((a) => a.toLowerCase().includes(q))
}

export function CityCombobox({ value, onValueChange, className }: CityComboboxProps) {
  const [allCities, setAllCities] = useState<City[] | null>(null)
  const [citiesLoading, setCitiesLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<City[]>([])
  const [open, setOpen] = useState(false)
  const skipNextRef = useRef(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchCities()
      .then(setAllCities)
      .catch(() => setAllCities([]))
      .finally(() => setCitiesLoading(false))
  }, [])

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }
    if (!allCities) return

    const query = value.trim()
    const filtered = query
      ? allCities.filter((c) => matches(c, query)).slice(0, MAX_SUGGESTIONS)
      : allCities.filter((c) => c.popular)
    setSuggestions(filtered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allCities])

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative flex-1 sm:flex-none">
          <Input
            id="city"
            placeholder={citiesLoading ? "Loading..." : "City"}
            value={value}
            disabled={citiesLoading}
            onChange={(e) => {
              onValueChange(e.target.value, null)
              setOpen(true)
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            className={cn(
              "h-auto border-0 bg-transparent dark:bg-transparent px-4 sm:px-2 py-2.5 sm:text-center text-sm font-semibold shadow-none focus-visible:ring-0",
              className,
            )}
          />
          {citiesLoading && (
            <Loader2Icon className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="p-0 w-50"
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
            <CommandEmpty>No cities found.</CommandEmpty>
            <CommandGroup>
              {suggestions.map((city) => (
                <CommandItem
                  key={city.code}
                  value={city.code}
                  onSelect={() => {
                    skipNextRef.current = true
                    setSuggestions([])
                    onValueChange(city.name, city)
                    setOpen(false)
                  }}
                >
                  {city.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

import { useState } from "react"
import { ClapperboardIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface MoviePosterProps {
  src: string | null
  className?: string
  iconClassName?: string
}

export function MoviePoster({ src, className, iconClassName }: MoviePosterProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-sm bg-muted", className)}>
        <ClapperboardIcon className={cn("text-muted-foreground", iconClassName)} />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={cn("shrink-0 object-cover", className)}
      onError={() => setFailed(true)}
    />
  )
}

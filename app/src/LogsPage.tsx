import { useEffect, useState } from "react"
import { AlertCircleIcon, ArrowLeftIcon, RefreshCwIcon } from "lucide-react"
import { Link } from "react-router-dom"

import { listWorkerLogs, type WorkerLog, type WorkerLogOutcome } from "@/lib/api"
import { formatApiDate } from "@/lib/utils"

function OutcomeBadge({ outcome }: { outcome: WorkerLogOutcome }) {
  if (outcome === "available") {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-green-500">
        Available
      </span>
    )
  }
  if (outcome === "error") {
    return (
      <span className="inline-flex w-fit items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
        Error
      </span>
    )
  }
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
      Not available
    </span>
  )
}

function formatDuration(ms: number | null) {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCheckedAt(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function LogsPage() {
  const [logs, setLogs] = useState<WorkerLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      setLogs(await listWorkerLogs())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs")
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-svh w-full">
      <div className="mx-auto max-w-220 px-6 pt-7">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-primary">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            </svg>
            <span className="font-display text-xl font-bold tracking-tight">Movie Radar</span>
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex size-10.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCwIcon className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-220 px-6 pt-13 pb-11">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
        <h1 className="font-display mb-2.5 text-3xl font-bold tracking-tight text-balance">Worker logs</h1>
        <p className="mb-7 max-w-115 text-[15px] text-muted-foreground">
          Every availability check the background worker has run, most recent first. It sweeps tracked shows every 5
          minutes.
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Couldn't load logs</p>
              <p className="mt-0.5 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {logs === null && !error && (
          <div className="rounded-2xl border-[1.5px] border-dashed border-border px-6 py-13 text-center">
            <p className="text-[13.5px] text-muted-foreground/70">Loading logs&hellip;</p>
          </div>
        )}

        {logs !== null && logs.length === 0 && (
          <div className="rounded-2xl border-[1.5px] border-dashed border-border px-6 py-13 text-center">
            <p className="text-[13.5px] text-muted-foreground/70">
              No checks yet. Once you track a show, they'll show up here every 5 minutes.
            </p>
          </div>
        )}

        {logs !== null && logs.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-3 font-semibold">Checked</th>
                    <th className="px-4 py-3 font-semibold">Movie</th>
                    <th className="px-4 py-3 font-semibold">City &middot; Date</th>
                    <th className="px-4 py-3 font-semibold">Theatre</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={log.id} className={idx > 0 ? "border-t border-border" : ""}>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatCheckedAt(log.checked_at)}
                      </td>
                      <td className="max-w-50 truncate px-4 py-3 font-semibold">{log.movie_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {log.city_name} &middot; {formatApiDate(log.date)}
                      </td>
                      <td className="max-w-45 truncate px-4 py-3 text-muted-foreground">
                        {log.theatre ?? "Any theatre"}
                      </td>
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={log.outcome} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDuration(log.duration_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

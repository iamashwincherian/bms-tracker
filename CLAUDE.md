# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

BMS Tracker: scrapes BookMyShow (in.bookmyshow.com) for movie showtimes via a headless Playwright browser, exposes it as a FastAPI backend, and lets users "track" a movie/city/date combo so a background worker polls it and emails them when tickets go on sale. Two parts:

- **Backend** (repo root): Python/FastAPI + Playwright scraper + SQLite tracking store.
- **Frontend** (`app/`): React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui ("new-york" style).

There's also a standalone `telegram_bot.py` (python-telegram-bot) that is not wired into the FastAPI app or worker — it's a separate, currently skeletal entry point.

## Commands

### Backend (repo root)
```bash
pip install -r requirements.txt
playwright install --with-deps chromium   # required once, browser binaries aren't in requirements.txt

uvicorn main:app --reload --port 8000     # run the API
python worker_service.py                  # run the tracked-show poller (separate process)
python telegram_bot.py                    # run the Telegram bot (separate, unwired entry point)
```
No test suite or linter is configured for the Python code.

### Frontend (`app/`)
```bash
npm install
npm run dev        # Vite dev server
npm run build       # tsc -b && vite build
npm run lint         # oxlint
npm run preview
```
Frontend talks to the backend via `VITE_API_BASE_URL` (see `app/.env.example`), defaulting to `http://localhost:8000`.

### Docker
`docker-compose.yml` runs two services from the same image (`Dockerfile`): `api` (uvicorn) and `worker` (`worker_service.py`), sharing a `tracked-data` volume mounted at `/app/data` for the SQLite DB. The `Dockerfile` `COPY`s Python files individually — new root-level `.py` modules must be added there explicitly to ship in the image.

## Architecture

### Scraping layer
- `browser.py` wraps Playwright: launches headless Chromium with anti-detection flags plus `playwright-stealth`, and exposes `init()/open(url)/close()`. One `Browser` instance = one browser process; callers are expected to `init()` and `close()` it per request/check (no pooling).
- `bms.py`'s `BMS` class does the actual scraping against BMS's `buytickets` and `cinemas` pages and the `quickbook-search.bms` JSON API, holding its own `Browser` instance. Key methods: `search_movies`, `get_cinemas`, `get_theatre_names`, `get_shows`.
- Scraping selectors intentionally read from ARIA attributes (`role="button"][aria-label]`) rather than BMS's CSS classes, since those are auto-generated and change often — preserve this pattern when touching selectors.
- BMS silently redirects to a different (bookable) date instead of erroring when the requested date is outside its booking window. Both `get_theatre_names` and `get_shows` guard against this by checking `_date_from_url(page.url)` against the requested date — don't remove this check or dates will silently return the wrong day's data as if it were correct.
- `cities.py` fetches and in-memory-caches (indefinitely, process lifetime) BMS's public region directory (`assets-in.bmscdn.com/discovery-catalog/response-cache/regions.json`) for the `/cities` endpoint. `main.py`'s `/cinemas` endpoint has its own similar in-process cache dict keyed by city.

### API layer (`main.py`)
FastAPI app with CORS wide open (`allow_origins=["*"]`). Endpoints: `/movies` (search), `/cities`, `/cinemas`, `/theatres`, `/shows` (the core scrape, optionally emails on availability via `send_email.py`), plus CRUD on `/tracked` for the tracking feature (`models.py`'s `TrackedShow`/`TrackedShowCreate`, backed by SQLite via `db.py`/SQLModel). `/tracked` POST is idempotent on `(movie_id, city_slug, date, theatre)`.

### Background worker (`worker.py` + `worker_service.py`)
`worker_service.py` is a standalone process (not part of the FastAPI app/uvicorn process) running an APScheduler job every 5 minutes that calls `worker.check_tracked_shows()`. This deliberately runs separately from the API so an API crash/restart/deploy doesn't take availability checking down with it — see the comment in `main.py`'s lifespan. `check_tracked_shows` re-scrapes every `pending` `TrackedShow`, bounded by `asyncio.Semaphore(CONCURRENCY=2)`; rows past their date flip to `expired` without scraping, rows that become available flip to `available`, get emailed once, and are never re-checked again.

### Frontend (`app/src`)
- `App.tsx` owns nearly all state (search inputs, result, tracked-shows list, theme, drawer state) and passes it down — no global state library.
- `lib/api.ts` is the sole fetch layer: typed wrappers per backend endpoint, a shared `ApiError`, and its own request-level in-memory caches for `/cities` (singleton promise) and `/cinemas` (per-city-slug promise map) mirroring the backend's caching.
- `components/ui/` is shadcn/ui generated code (Radix primitives + `cva`) — regenerate/extend via shadcn conventions rather than hand-rolling equivalents. Path alias `@/*` → `app/src/*` (see `vite.config.ts` and `components.json`).
- Theming (`lib/theme.ts`) is a manual light/dark toggle persisted outside React state, applied via a `data-theme`-style mechanism read at startup before React state initializes.

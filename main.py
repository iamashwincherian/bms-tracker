import os
from contextlib import asynccontextmanager

from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import APIRouter, FastAPI, HTTPException
from sqlmodel import Session, select
from typing import Optional

from bms import BMS
from cities import get_cities
from db import create_db_and_tables, engine
from models import TrackedShow, TrackedShowCreate, WorkerLog
from send_email import send_email

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Table creation only - the tracked-show check loop runs in the
    # separate `worker_service.py` process so an API crash/restart/deploy
    # doesn't take availability checking down with it.
    create_db_and_tables()
    yield

app = FastAPI(
    title="BMS Scraper API",
    description="API for scraping BookMyShow website",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# All backend routes live under /api so they can't collide with the
# frontend's own client-side routes (e.g. /logs) when both are served from
# the same origin in production - see the static-file mount at the bottom.
api = APIRouter(prefix="/api")

@api.get("/health")
async def health():
    """Health check endpoint"""
    return {"message": "BMS Scraper API is running"}

@api.get("/theatres")
async def get_theatre_names(
    city: str,
    movie: str,
    movie_id: str,
    date: str,
):
    """
    Get the theatre names for a given city, movie, and date

    - **city**: City name (e.g., kochi, mumbai, delhi)
    - **movie**: Movie name (e.g., The Dark Knight, The Dark Knight Rises, The Dark Knight)
    - **movie_id**: BMS movie ID (from /movies search)
    - **date**: Date in YYYYMMDD format (e.g., 20250830)
    """
    try:
        bms = BMS(city, movie, date, movie_id=movie_id)
        await bms.init()
        try:
            res = await bms.get_theatre_names()
            await bms.close()
            return JSONResponse(content={"success": True, "theatres": res})
        finally:
            await bms.close()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@api.get("/shows")
async def search_shows(
    city: str,
    movie: str,
    movie_id: str,
    date: str,
    theatre: Optional[str] = None,
    send_email_to: Optional[str] = None
):
    """
    Scan BMS website for movie tickets

    - **city**: City name (e.g., kochi, mumbai, delhi)
    - **date**: Date in YYYYMMDD format (e.g., 20250830)
    - **theatre**: Theatre name to filter (e.g., PVR, INOX) - optional
    """
    bms = BMS(city, movie, date, theatre, movie_id)
    await bms.init()
    try:
        res = await bms.get_shows()
        if send_email_to and res["show_available"]:
            await send_email(send_email_to, res)
        return JSONResponse(content=res)
    finally:
        await bms.close()

@api.get("/movies")
async def search_movies(
    query: str,
    city: Optional[str] = ""
):
    """
    Search for movies
    """
    bms = BMS(city=city)
    await bms.init()

    try:
        res = await bms.search_movies(query)
        return JSONResponse(content=res)
    finally:
        await bms.close()

@api.get("/cities")
async def list_cities():
    """
    List cities BookMyShow supports (name, region code, and URL slug),
    sourced from BMS's own region directory.
    """
    return await get_cities()

_cinemas_cache: dict[str, list] = {}

@api.get("/cinemas")
async def list_cinemas(city: str):
    """
    List all cinemas in a city (independent of any specific movie/date),
    scraped from BMS's own cinema directory page. Cached in-process per
    city since this scrape is slow and the venue list changes rarely.
    """
    key = city.lower()
    if key in _cinemas_cache:
        return _cinemas_cache[key]

    bms = BMS(city=city)
    await bms.init()
    try:
        cinemas = await bms.get_cinemas()
        _cinemas_cache[key] = cinemas
        return cinemas
    finally:
        await bms.close()

@api.post("/tracked")
async def create_tracked_show(payload: TrackedShowCreate) -> TrackedShow:
    """
    Track a movie/city/date (optionally theatre-specific) so the background
    worker periodically re-checks it and emails notify_email once it
    becomes available. Idempotent: tracking the same combination again
    returns the existing row instead of creating a duplicate.
    """
    with Session(engine) as session:
        existing = session.exec(
            select(TrackedShow).where(
                TrackedShow.movie_id == payload.movie_id,
                TrackedShow.city_slug == payload.city_slug,
                TrackedShow.date == payload.date,
                TrackedShow.theatre == payload.theatre,
            )
        ).first()
        if existing:
            return existing

        row = TrackedShow(**payload.model_dump())
        session.add(row)
        session.commit()
        session.refresh(row)
        return row

@api.get("/tracked")
async def list_tracked_shows() -> list[TrackedShow]:
    """List all tracked shows, most recently created first."""
    with Session(engine) as session:
        return session.exec(select(TrackedShow).order_by(TrackedShow.created_at.desc())).all()

@api.delete("/tracked/{tracked_id}")
async def delete_tracked_show(tracked_id: int):
    """Stop tracking a show."""
    with Session(engine) as session:
        row = session.get(TrackedShow, tracked_id)
        if not row:
            raise HTTPException(status_code=404, detail="Tracked show not found")
        session.delete(row)
        session.commit()
        return {"success": True}

@api.get("/logs")
async def list_worker_logs(limit: int = 200) -> list[WorkerLog]:
    """
    Most recent background-worker availability checks, newest first. One
    row per bms.get_shows() call the worker actually made (not per tick -
    expired/already-available tracked rows are skipped without scraping).
    """
    with Session(engine) as session:
        return session.exec(
            select(WorkerLog).order_by(WorkerLog.checked_at.desc()).limit(limit)
        ).all()

app.include_router(api)

# Serve the built frontend (see Dockerfile's frontend build stage) as static
# files, with a catch-all so client-side routes like /logs resolve to
# index.html on direct navigation/refresh too. Only present in the built
# Docker image - absent in local dev, where the frontend runs separately via
# `npm run dev` and talks to this API directly, so this block is skipped.
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

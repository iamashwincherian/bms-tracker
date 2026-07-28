from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class TrackedShow(SQLModel, table=True):
    """
    A movie/city/date (optionally theatre-specific) combination the
    background worker periodically re-checks for availability.

    status: "pending" (not yet available, still being checked),
    "available" (found and notified, no longer actively checked),
    or "expired" (date has passed without ever becoming available).
    """
    id: Optional[int] = Field(default=None, primary_key=True)

    movie_id: str
    movie_name: str
    movie_slug: str
    movie_poster: Optional[str] = None

    city_name: str
    city_code: str
    city_slug: str

    date: str
    theatre: Optional[str] = None
    notify_email: str

    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_checked_at: Optional[datetime] = None
    notified_at: Optional[datetime] = None


class TrackedShowCreate(SQLModel):
    movie_id: str
    movie_name: str
    movie_slug: str
    movie_poster: Optional[str] = None

    city_name: str
    city_code: str
    city_slug: str

    date: str
    theatre: Optional[str] = None
    notify_email: str


class WorkerLog(SQLModel, table=True):
    """
    One row per actual BMS availability check the background worker
    performed (i.e. per bms.get_shows() call) - not per tracked row per
    tick, since expired/already-available rows are skipped without
    scraping and aren't logged here.

    outcome: "available" (show found, tracked row marked available and
    emailed), "not_available" (checked, still nothing on sale), or
    "error" (the scrape itself raised).
    """
    id: Optional[int] = Field(default=None, primary_key=True)

    tracked_show_id: Optional[int] = None
    movie_name: str
    city_name: str
    date: str
    theatre: Optional[str] = None

    outcome: str
    message: Optional[str] = None
    duration_ms: Optional[int] = None

    checked_at: datetime = Field(default_factory=datetime.utcnow)

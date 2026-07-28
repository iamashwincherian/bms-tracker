import asyncio
import time
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from bms import BMS
from db import engine
from models import TrackedShow, WorkerLog
from send_email import send_email

CONCURRENCY = 2


async def check_tracked_shows():
    """
    Re-check every "pending" tracked show for availability. Runs on a
    fixed interval via APScheduler (see main.py's lifespan). Expired
    (past-dated) rows are marked and skipped without scraping; rows that
    become available are marked, emailed once, and not re-checked again.
    """
    today = datetime.now().strftime("%Y%m%d")

    with Session(engine) as session:
        pending = session.exec(select(TrackedShow).where(TrackedShow.status == "pending")).all()

    to_check = []
    for row in pending:
        if row.date < today:
            _update_row(row.id, status="expired", last_checked_at=datetime.utcnow())
        else:
            to_check.append(row)

    if not to_check:
        return

    semaphore = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(_check_one(row, semaphore) for row in to_check))


async def _check_one(row: TrackedShow, semaphore: asyncio.Semaphore):
    async with semaphore:
        started = time.monotonic()
        bms = BMS(row.city_slug, row.movie_slug, row.date, row.theatre or "", row.movie_id)
        await bms.init()
        try:
            result = await bms.get_shows()
        except Exception as e:
            print(f"Error checking tracked show {row.id}: {e}")
            _update_row(row.id, last_checked_at=datetime.utcnow())
            _log_check(row, outcome="error", message=str(e), duration_ms=_elapsed_ms(started))
            return
        finally:
            await bms.close()

        duration_ms = _elapsed_ms(started)
        if result.get("show_available"):
            _update_row(row.id, status="available", last_checked_at=datetime.utcnow(), notified_at=datetime.utcnow())
            _log_check(row, outcome="available", message=result.get("message"), duration_ms=duration_ms)
            await send_email(row.notify_email, result)
        else:
            _update_row(row.id, last_checked_at=datetime.utcnow())
            _log_check(row, outcome="not_available", message=result.get("message"), duration_ms=duration_ms)


def _elapsed_ms(started: float) -> int:
    return round((time.monotonic() - started) * 1000)


def _update_row(row_id: int, **fields):
    with Session(engine) as session:
        row = session.get(TrackedShow, row_id)
        if not row:
            return
        for key, value in fields.items():
            setattr(row, key, value)
        session.add(row)
        session.commit()


def _log_check(row: TrackedShow, outcome: str, message: Optional[str] = None, duration_ms: Optional[int] = None):
    with Session(engine) as session:
        log = WorkerLog(
            tracked_show_id=row.id,
            movie_name=row.movie_name,
            city_name=row.city_name,
            date=row.date,
            theatre=row.theatre,
            outcome=outcome,
            message=message,
            duration_ms=duration_ms,
        )
        session.add(log)
        session.commit()

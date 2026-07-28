import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from db import create_db_and_tables
from worker import check_tracked_shows

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("worker_service")


async def main():
    create_db_and_tables()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        check_tracked_shows,
        "interval",
        minutes=5,
        id="check_tracked_shows",
        next_run_time=datetime.now(),
    )
    scheduler.start()
    logger.info("Tracked-show worker started - checking every 5 minutes")

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    finally:
        scheduler.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped")

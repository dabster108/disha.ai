"""Logging for scrape runs: human console output + optional per-run files.

Events (see run.py): RUN_START, SOURCE_START, SOURCE_DONE, SOURCE_FAILED,
DEDUP, RUN_DONE — each logged as a readable line and, when file logging is
on, mirrored as JSONL for machine consumption.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

LOGS_DIR = Path(__file__).resolve().parents[1] / "data" / "logs"

logger = logging.getLogger("disha.scraper")


class _JsonlFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "level": record.levelname,
            "event": getattr(record, "event", None),
            "message": record.getMessage(),
        }
        payload.update(getattr(record, "fields", {}))
        return json.dumps(payload, ensure_ascii=False)


def setup_logging(*, to_file: bool = False) -> str | None:
    """Configure the scraper logger. Returns the log file path if file logging is on."""
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(console)

    if not to_file:
        return None

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    file_handler = logging.FileHandler(LOGS_DIR / f"scrape-{stamp}.log", encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(file_handler)

    jsonl_handler = logging.FileHandler(LOGS_DIR / f"scrape-{stamp}.jsonl", encoding="utf-8")
    jsonl_handler.setFormatter(_JsonlFormatter())
    logger.addHandler(jsonl_handler)

    return str(LOGS_DIR / f"scrape-{stamp}.log")


def log_event(event: str, message: str, **fields) -> None:
    logger.info(message, extra={"event": event, "fields": fields})

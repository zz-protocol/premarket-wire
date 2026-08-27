# -*- coding: utf-8 -*-
"""Refresh windows in Asia/Shanghai. Frozen during the A-share cash session."""
from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")

HIGH_START = time(7, 30)
HIGH_END = time(9, 30)      # exclusive
FROZEN_END = time(21, 30)   # exclusive; frozen is [09:30, 21:30)
LOW_END = time(4, 0)        # exclusive; low-freq is [21:30, 04:00)


def now_shanghai(now: datetime | None = None) -> datetime:
    if now is None:
        return datetime.now(SHANGHAI)
    if now.tzinfo is None:
        return now.replace(tzinfo=SHANGHAI)
    return now.astimezone(SHANGHAI)


def refresh_mode(now: datetime | None = None) -> str:
    """Return 'high' | 'frozen' | 'low' | 'skip'."""
    dt = now_shanghai(now)
    if dt.weekday() >= 5:
        return "skip"
    t = dt.time()
    if HIGH_START <= t < HIGH_END:
        return "high"
    if HIGH_END <= t < FROZEN_END:
        return "frozen"
    if t >= FROZEN_END or t < LOW_END:
        return "low"
    return "skip"


def is_frozen(now: datetime | None = None) -> bool:
    return refresh_mode(now) == "frozen"


def allow_refresh(now: datetime | None = None, force: bool = False) -> tuple[bool, str]:
    """Whether POST /api/refresh should fetch. force=True bypasses windows (token still required)."""
    if force:
        return True, "force"
    mode = refresh_mode(now)
    if mode == "frozen":
        return False, "frozen"
    if mode == "skip":
        return False, "skip"
    return True, mode


def should_run_scheduled(now: datetime | None = None) -> bool:
    """15-minute cron tick: high-freq always; low-freq on the hour (and 21:30)."""
    dt = now_shanghai(now)
    mode = refresh_mode(dt)
    if mode == "high":
        return True
    if mode == "low":
        return dt.minute == 0 or (dt.hour == 21 and dt.minute == 30)
    return False

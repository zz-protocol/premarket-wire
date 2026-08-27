# -*- coding: utf-8 -*-
"""Freeze-window unit tests with constructed datetimes."""
from __future__ import annotations

import unittest
from datetime import datetime

from refresh_policy import (
    SHANGHAI,
    allow_refresh,
    is_frozen,
    refresh_mode,
    should_run_scheduled,
)


def dt(y, m, d, hh, mm, ss=0):
    return datetime(y, m, d, hh, mm, ss, tzinfo=SHANGHAI)


THU = (2026, 8, 27)
SAT = (2026, 8, 29)
SUN = (2026, 8, 30)


class FreezeWindowTests(unittest.TestCase):
    def test_high_freq_morning(self):
        self.assertEqual(refresh_mode(dt(*THU, 7, 30)), "high")
        self.assertEqual(refresh_mode(dt(*THU, 8, 0)), "high")
        self.assertEqual(refresh_mode(dt(*THU, 9, 29)), "high")
        self.assertFalse(is_frozen(dt(*THU, 8, 15)))
        ok, reason = allow_refresh(dt(*THU, 8, 0))
        self.assertTrue(ok)
        self.assertEqual(reason, "high")

    def test_frozen_cash_session(self):
        self.assertEqual(refresh_mode(dt(*THU, 9, 30)), "frozen")
        self.assertEqual(refresh_mode(dt(*THU, 10, 0)), "frozen")
        self.assertEqual(refresh_mode(dt(*THU, 15, 0)), "frozen")
        self.assertEqual(refresh_mode(dt(*THU, 21, 29)), "frozen")
        self.assertTrue(is_frozen(dt(*THU, 10, 0)))
        ok, reason = allow_refresh(dt(*THU, 10, 0))
        self.assertFalse(ok)
        self.assertEqual(reason, "frozen")

    def test_force_bypasses_freeze(self):
        ok, reason = allow_refresh(dt(*THU, 10, 0), force=True)
        self.assertTrue(ok)
        self.assertEqual(reason, "force")

    def test_low_freq_us_session(self):
        self.assertEqual(refresh_mode(dt(*THU, 21, 30)), "low")
        self.assertEqual(refresh_mode(dt(*THU, 22, 0)), "low")
        self.assertEqual(refresh_mode(dt(*THU, 0, 0)), "low")
        self.assertEqual(refresh_mode(dt(*THU, 3, 59)), "low")
        ok, reason = allow_refresh(dt(*THU, 22, 0))
        self.assertTrue(ok)
        self.assertEqual(reason, "low")

    def test_idle_before_high_freq(self):
        self.assertEqual(refresh_mode(dt(*THU, 4, 0)), "skip")
        self.assertEqual(refresh_mode(dt(*THU, 5, 30)), "skip")
        self.assertEqual(refresh_mode(dt(*THU, 7, 29)), "skip")
        ok, reason = allow_refresh(dt(*THU, 5, 0))
        self.assertFalse(ok)
        self.assertEqual(reason, "skip")

    def test_weekend_skip(self):
        self.assertEqual(refresh_mode(dt(*SAT, 8, 0)), "skip")
        self.assertEqual(refresh_mode(dt(*SUN, 22, 0)), "skip")
        ok, reason = allow_refresh(dt(*SAT, 8, 0))
        self.assertFalse(ok)
        self.assertEqual(reason, "skip")
        ok2, reason2 = allow_refresh(dt(*SAT, 8, 0), force=True)
        self.assertTrue(ok2)
        self.assertEqual(reason2, "force")

    def test_scheduler_high_fires_quarter_hours(self):
        self.assertTrue(should_run_scheduled(dt(*THU, 7, 30)))
        self.assertTrue(should_run_scheduled(dt(*THU, 8, 15)))
        self.assertTrue(should_run_scheduled(dt(*THU, 9, 15)))
        self.assertFalse(should_run_scheduled(dt(*THU, 9, 30)))

    def test_scheduler_low_hourly_only(self):
        self.assertTrue(should_run_scheduled(dt(*THU, 21, 30)))
        self.assertTrue(should_run_scheduled(dt(*THU, 22, 0)))
        self.assertFalse(should_run_scheduled(dt(*THU, 22, 15)))
        self.assertFalse(should_run_scheduled(dt(*THU, 22, 45)))
        self.assertTrue(should_run_scheduled(dt(*THU, 2, 0)))
        self.assertFalse(should_run_scheduled(dt(*THU, 2, 15)))

    def test_scheduler_skips_frozen_and_weekend(self):
        self.assertFalse(should_run_scheduled(dt(*THU, 12, 0)))
        self.assertFalse(should_run_scheduled(dt(*SAT, 8, 0)))
        self.assertFalse(should_run_scheduled(dt(*SAT, 22, 0)))


if __name__ == "__main__":
    unittest.main()

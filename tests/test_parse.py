# -*- coding: utf-8 -*-
"""Parser fixtures captured from live Sina/Yahoo payloads. Do not guess hf_* indices."""
from __future__ import annotations

import unittest

from market_data import parse_fx_cnh, parse_gb, parse_hf


class ParseTests(unittest.TestCase):
    def test_hf_nq_prev_is_index_7(self):
        # var hq_str_hf_NQ= captured 2026-08-27
        fields = "29567.010,,29558.000,29559.500,29662.000,29401.750,20:43:41,29289.500,29499.500,0,1,1,2026-08-27,纳斯达克指数期货,0".split(",")
        price, pct = parse_hf(fields)
        self.assertAlmostEqual(price, 29567.010)
        expected = (29567.010 - 29289.500) / 29289.500 * 100
        self.assertAlmostEqual(pct, expected)

    def test_gb_change_pct_is_index_2(self):
        fields = "台积电,417.6900,0.07,2026-08-27 20:43:35".split(",")
        price, pct = parse_gb(fields)
        self.assertAlmostEqual(price, 417.69)
        self.assertAlmostEqual(pct, 0.07)

    def test_fx_cnh_percent_is_index_10(self):
        fields = "20:43:35,6.719600,6.720000,6.721600,61,6.722600,6.722900,6.716800,6.719600,离岸人民币（香港）,-0.030000,-0.002000,0.0009074,,6.995700,6.715000,,2026-08-27".split(",")
        price, pct = parse_fx_cnh(fields)
        self.assertAlmostEqual(price, 6.7196)
        self.assertAlmostEqual(pct, -0.03)

    def test_hf_short_payload_does_not_crash(self):
        price, pct = parse_hf(["1.0"])
        self.assertIsNone(price)
        self.assertIsNone(pct)


if __name__ == "__main__":
    unittest.main()

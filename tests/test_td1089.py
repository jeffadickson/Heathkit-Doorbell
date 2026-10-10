"""Checks that tie the emulator and page back to the schematic data."""
import json
import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ladder_fit  # noqa: E402

DATA = json.load(open(os.path.join(ROOT, "src", "td1089.json")))
EMU = open(os.path.join(ROOT, "emulator", "td1089.js"), encoding="utf-8").read()


class Ladder(unittest.TestCase):
    def test_fit_matches_recorded_values(self):
        worst, offset, _ = ladder_fit.fit([r[1] for r in DATA["ladder_top_to_bottom"]])
        self.assertEqual(offset, DATA["fitted_offset_ohms"])
        self.assertLessEqual(worst, DATA["max_cents_error"])

    def test_thirteen_notes(self):
        self.assertEqual(len(DATA["ladder_top_to_bottom"]), DATA["matrix"]["notes"])

    def test_emulator_uses_schematic_values(self):
        pairs = re.findall(r'\["(R\d+)",(\d+)\]', EMU)
        want = [(r[0], str(r[1])) for r in DATA["ladder_top_to_bottom"]]
        self.assertEqual(pairs, want)
        m = re.search(r"X_OFFSET\s*=\s*(\d+)", EMU)
        self.assertEqual(int(m.group(1)), DATA["fitted_offset_ohms"])

    def test_emulator_matrix_limits(self):
        self.assertIn("BEATS = 16", EMU)
        self.assertIn("MAX_PER_ROW = 9", EMU)


class Presets(unittest.TestCase):
    def test_presets_fit_the_kit(self):
        block = re.search(r"const PRESETS = \{(.*?)\n  \};", EMU, re.S).group(1)
        for name, body in re.findall(r'"([^"]+)":\s*\[([^\]]*)\]', block):
            notes = [int(x) for x in body.split(",")]
            self.assertEqual(len(notes), 16, name)
            for n in set(notes) - {-1}:
                self.assertTrue(0 <= n <= 12, name)
                self.assertLessEqual(notes.count(n), 9, f"{name}: note {n} over 9 sockets")


class Price(unittest.TestCase):
    def test_todays_dollars(self):
        c = DATA["catalog"]
        self.assertEqual(round(c["fall_1978_price_usd"] * c["cpi_u_aug_2026"] / c["cpi_u_1978"]), 231)
        self.assertEqual(round(c["fall_1984_price_usd"] * c["cpi_u_aug_2026"] / c["cpi_u_1984"]), 161)


if __name__ == "__main__":
    unittest.main()

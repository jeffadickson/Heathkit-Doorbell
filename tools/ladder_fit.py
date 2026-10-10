#!/usr/bin/env python3
"""Fit the TD-1089 note ladder (R31-R44) to equal temperament.

Pitch of the tone oscillator goes as 1 / (R_offset + R_string), where
R_string is the series resistance from the top of the ladder down to the
tap the plugged lead grounds, and R_offset is the TUNING pot (R45) plus
whatever the oscillator itself contributes. We sweep R_offset and keep the
value that minimises the worst-case error against 12-TET.

Usage: ladder_fit.py src/td1089.json > build/ladder.json
"""
import json
import math
import sys


def cents_errors(values, offset):
    totals, s = [], offset
    for v in values:
        s += v
        totals.append(s)
    lowest = totals[-1]  # bottom row = low C
    errs = []
    for k, total in enumerate(totals):  # k = 0 is the top row (C')
        semis = 12 - k
        errs.append(1200 * math.log2(lowest / total) - 100 * semis)
    return errs


def fit(values, lo=15000, hi=40000, step=50):
    best = None
    for offset in range(lo, hi, step):
        errs = cents_errors(values, offset)
        worst = max(abs(e) for e in errs)
        if best is None or worst < best[0]:
            best = (worst, offset, errs)
    return best


def main(path):
    data = json.load(open(path))
    rows = data["ladder_top_to_bottom"]
    worst, offset, errs = fit([r[1] for r in rows])
    out = {
        "fitted_offset_ohms": offset,
        "max_cents_error": round(worst, 2),
        "rows": [
            {"ref": r[0], "ohms": r[1], "note": r[2], "cents_error": round(e, 2)}
            for r, e in zip(rows, errs)
        ],
    }
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "src/td1089.json")

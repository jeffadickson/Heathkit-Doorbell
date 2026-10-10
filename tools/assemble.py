#!/usr/bin/env python3
"""Inline the emulator into the page to make the single-file web build.

Usage: assemble.py src/page.html emulator/td1089.js > web/index.html
"""
import sys

MARK = "/*@EMULATOR@*/"

page = open(sys.argv[1], encoding="utf-8").read()
emu = open(sys.argv[2], encoding="utf-8").read()
if page.count(MARK) != 1:
    sys.exit(f"assemble: expected exactly one {MARK} in {sys.argv[1]}")
sys.stdout.write(page.replace(MARK, emu))

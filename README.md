# Heathkit TD-1089 Programmable Electronic Chimes

A study of Heath's 1970s programmable doorbell kit: a browser emulator built from the schematic, a stage-by-stage circuit walkthrough, the story of its designer, and what it cost.

The TD-1089 played any tune up to 16 notes from a one-octave (C to C) socket board. Sixteen beat leads came off a 74154 decoder; you pushed each lead into one of nine sockets in a note's row. No microprocessor and no ROM: three TTL chips, a dozen transistors, and a string of thirteen resistors that hits equal temperament within about 4 cents.

*For Mom, who always wanted bells.*

## Layout

| Path | What it holds |
|---|---|
| `src/page.html` | The explainer page, with an `/*@EMULATOR@*/` slot for the script |
| `src/td1089.json` | Circuit data from the schematic: ladder resistors, ICs, matrix limits, catalog prices, schematic checksum |
| `emulator/td1089.js` | The emulator: matrix and wire-board UI, Web Audio model of the tone, divider, decay and filter stages |
| `tools/assemble.py` | Inlines the emulator into the page |
| `tools/ladder_fit.py` | Fits the R31–R44 ladder to 12-TET and reports per-note error |
| `tools/fetch_schematic.sh` | Downloads Heath's schematic PDF and checks its SHA-256 |
| `build/` | Generated `ladder.json` and `SHA256SUMS` for every committed binary |
| `web/index.html` | Single-file web build, the page you open or host |
| `tests/` | Ties the emulator back to the schematic data; checks presets and price math |
| `book/` | Write-up and figures (all rights reserved); `book/heath/` holds Heath's own material |

## Build and verify

```sh
make            # rebuild web/index.html, build/ladder.json, build/SHA256SUMS
make verify     # rebuild into a scratch dir, require byte-identical output,
                # check every binary against build/SHA256SUMS, run the tests
make schematic  # fetch Heath's schematic PDF (595-1826-05) and check its hash
```

Needs Python 3 and Node (for `node --check`). Open `web/index.html` in a browser to run the emulator; sound starts when you press a door button.

## Sources

- Schematic: Heath 595-1826-05, © 1975 Heath Company, via the [vintage-radio.info Heathkit archive](https://www.vintage-radio.info/heathkit/)
- Heathkit Catalog 841, Fall 1978, and Fall 1984 catalog, via [World Radio History](https://www.worldradiohistory.com/Archive-Catalogs/Heathkit-Catalogs/)
- Terry Perdue, K8TP, ["TD-1089 Toilet Flush Alarm"](https://puck.nether.net/pipermail/heath/2010-January/025341.html), Heath mailing list, January 2010

## License

Code (`src/`, `emulator/`, `tools/`, `tests/`, `Makefile`, `web/`) is MIT; see `LICENSE`.
The book and art in `book/` are © Jeff Dickson, all rights reserved; see `book/LICENSE`.
Heath schematic captures in `book/heath/` are © 1975 Heath Company and are included for reference and study.

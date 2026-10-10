# Heathkit TD-1089 — build and verify.
#   make          rebuild web/index.html and build/ outputs
#   make verify   rebuild into a scratch dir and require byte-identical output,
#                 check every committed binary against build/SHA256SUMS, run tests
#   make schematic  fetch Heath's schematic PDF if missing and check its hash

PY      ?= python3
NODE    ?= node
SRC      = src/page.html src/td1089.json
EMU      = emulator/td1089.js
OUT_WEB  = web/index.html
OUT_LAD  = build/ladder.json
SUMS     = build/SHA256SUMS
TMP     := $(shell mktemp -d 2>/dev/null || echo /tmp/td1089-verify)

# Every tracked binary, checksummed. The schematic PDF is listed when present.
BINARIES = $(OUT_WEB) $(OUT_LAD) $(wildcard book/heath/schematic/*.jpg) $(wildcard book/heath/*.pdf)

.PHONY: all verify test schematic sums clean

all: $(OUT_WEB) $(OUT_LAD) sums

$(OUT_WEB): src/page.html $(EMU) tools/assemble.py
	$(PY) tools/assemble.py src/page.html $(EMU) > $@

$(OUT_LAD): src/td1089.json tools/ladder_fit.py
	$(PY) tools/ladder_fit.py src/td1089.json > $@

sums:
	sha256sum $(BINARIES) > $(SUMS)

test:
	$(NODE) --check $(EMU)
	$(PY) -m unittest discover -s tests -v

verify: test
	$(PY) tools/assemble.py src/page.html $(EMU) > $(TMP)/index.html
	cmp $(TMP)/index.html $(OUT_WEB)
	$(PY) tools/ladder_fit.py src/td1089.json > $(TMP)/ladder.json
	cmp $(TMP)/ladder.json $(OUT_LAD)
	sha256sum -c --quiet $(SUMS)
	@rm -rf $(TMP)
	@echo "verify: OK — web build and all binaries match"

schematic:
	sh tools/fetch_schematic.sh

clean:
	rm -f $(OUT_WEB) $(OUT_LAD) $(SUMS)

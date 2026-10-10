#!/bin/sh
# Download Heath's TD-1089 schematic (595-1826-05) and check it byte-for-byte.
set -eu
out=book/heath/td1089-schematic.pdf
url=$(python3 -c 'import json;print(json.load(open("src/td1089.json"))["schematic"]["source_url"])')
want=$(python3 -c 'import json;print(json.load(open("src/td1089.json"))["schematic"]["sha256"])')
if [ ! -f "$out" ]; then
  echo "fetching $url"
  curl -fsSL -o "$out" "$url"
fi
got=$(sha256sum "$out" | cut -d' ' -f1)
if [ "$got" != "$want" ]; then
  echo "schematic checksum mismatch: $got (want $want)" >&2
  exit 1
fi
echo "schematic OK ($got)"

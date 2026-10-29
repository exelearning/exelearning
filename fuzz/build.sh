#!/bin/sh
# Bundle each fuzz target to CommonJS for Jazzer.js (Node; no Bun needed).
# Local run: sh fuzz/build.sh && npx @jazzer.js/core fuzz/dist/legacy_xml_parser.fuzz.js
set -eu
cd "$(dirname "$0")/.."
for f in fuzz/*.fuzz.ts; do
    npx esbuild "$f" --bundle --platform=node --format=cjs --outfile="fuzz/dist/$(basename "$f" .ts).js"
done

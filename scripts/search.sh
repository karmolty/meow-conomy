#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: npm run search -- <pattern> [path...]" >&2
  echo "example: npm run search -- heat src site" >&2
  exit 2
fi

pattern="$1"
shift

if [ "$#" -eq 0 ]; then
  # Default to the interesting folders.
  set -- src site scripts
fi

# -R: recursive, -I: skip binary files, -n: line numbers
# Use || true so 'no matches' doesn't fail the npm script.
grep -RInI "$pattern" "$@" || true

#!/usr/bin/env sh
set -eu

# Speed: force a byte-wise locale for grep (much faster on large trees).
# Respect any user-supplied LC_ALL.
export LC_ALL="${LC_ALL:-C}"

if [ "$#" -lt 1 ]; then
  echo "usage: npm run search -- <pattern> [path...]" >&2
  echo "example: npm run search -- \"heat\" src site" >&2
  echo "tip: set SEARCH_RE=1 to treat <pattern> as an extended regex (grep -E)" >&2
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
#
# Env knobs:
# - SEARCH_RE=1      treat <pattern> as an extended regex (grep -E)
# - SEARCH_ICASE=1   case-insensitive search (grep -i)

icase=""
if [ "${SEARCH_ICASE:-}" = "1" ]; then
  icase="-i"
fi

if [ "${SEARCH_RE:-}" = "1" ]; then
  # -E: extended regex
  # -e + -- avoids patterns that start with '-' being treated as flags.
  grep -RInIE $icase -e "$pattern" -- "$@" || true
else
  # -e + -- avoids patterns that start with '-' being treated as flags.
  grep -RInI $icase -e "$pattern" -- "$@" || true
fi

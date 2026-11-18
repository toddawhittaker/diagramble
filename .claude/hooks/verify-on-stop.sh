#!/usr/bin/env bash
# Stop hook for agents that edit TypeScript: refuse to finish while
# typecheck or lint fails in the agent's working directory. It always runs
# both checks; a few minutes is cheaper than a red CI run.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
input="$(cat)"
if command -v jq >/dev/null 2>&1; then
  cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
else
  cwd="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))')"
fi
[ -n "$cwd" ] || exit 0
cd "$cwd" 2>/dev/null || exit 0
root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# shellcheck source-path=SCRIPTDIR source=node-path.sh
. "$here/node-path.sh"
bin="$(node_bin_for "$root")"
[ -n "$bin" ] && export PATH="$bin:$PATH"

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
# The prototype is its own npm project; the real application will sit at
# the root (SPEC.md section 12). Check each one that has dependencies installed.
for dir in "$root" "$root/prototype"; do
  if [ ! -f "$dir/package.json" ] || [ ! -d "$dir/node_modules" ]; then
    continue
  fi
  for check in typecheck lint; do
    grep -q "\"$check\":" "$dir/package.json" || continue
    if ! (cd "$dir" && npm run --silent "$check") >"$log" 2>&1; then
      {
        echo "npm run $check failed in $dir. Fix it before you finish. Last lines:"
        tail -n 40 "$log"
      } >&2
      exit 2
    fi
  done
done
exit 0

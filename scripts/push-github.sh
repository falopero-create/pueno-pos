#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:-akasia-pos}"
VIS="${2:-private}"
if ! gh auth status >/dev/null 2>&1; then
  echo "gh not authenticated" >&2
  exit 1
fi
OWNER=$(gh api user -q .login)
# create if missing
if ! gh repo view "$OWNER/$NAME" >/dev/null 2>&1; then
  gh repo create "$NAME" --"$VIS" --source=. --remote=github --push
else
  git remote remove github 2>/dev/null || true
  git remote add github "https://github.com/$OWNER/$NAME.git"
  git push -u github main
fi
echo "REPO=https://github.com/$OWNER/$NAME"

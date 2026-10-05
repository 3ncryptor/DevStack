#!/usr/bin/env bash
# Vercel's Ignored Build Step (vercel.json `ignoreCommand`): exit 0 skips the deploy, 1 builds.
# Compares against the last successful deploy, not HEAD^, so a push of several commits is judged
# as a whole. Builds when there is nothing to compare with: the first deploy, or a previous
# commit outside Vercel's shallow clone.
set -u

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$previous" ] || ! git cat-file -e "$previous^{commit}" 2>/dev/null; then
  echo "No previous deploy to compare with: building."
  exit 1
fi

# What the site is built from: itself, the CLI it imports, and the README its docs render.
if git diff --quiet "$previous" HEAD -- . ../src ../scripts ../README.md ../package.json ../package-lock.json; then
  echo "Nothing the site uses changed since $previous: skipping."
  exit 0
fi
echo "The site's sources changed since $previous: building."
exit 1

#!/bin/sh
# Publishes the release tarball (RELEASING.md):
#
#   sh scripts/npm-publish.sh <create-devstack-app-<version>.tgz>
#
# Idempotent: a version already on the registry is skipped, so a release that failed halfway can be
# re-run. The registry, credentials and provenance come from the npm config and environment (the
# release workflow sets NPM_CONFIG_PROVENANCE=true; the rehearsal points it at a local registry).
set -eu

tarball=${1:?usage: sh scripts/npm-publish.sh <tarball>}
version=$(node -p 'require("./package.json").version')

if [ ! -f "$tarball" ]; then
    echo "npm-publish: $tarball is missing" >&2
    exit 1
fi
# An absolute path: npm reads a relative `dir/file.tgz` as a GitHub repository (`user/repo`).
tarball=$(cd "$(dirname "$tarball")" && pwd)/$(basename "$tarball")
if npm view "create-devstack-app@$version" version >/dev/null 2>&1; then
    echo "npm-publish: create-devstack-app@$version is already published, skipping"
    exit 0
fi
npm publish "$tarball" --access public
echo "npm-publish: published create-devstack-app@$version"

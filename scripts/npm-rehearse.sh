#!/bin/sh
# Rehearses the npm release against a throwaway local registry (Verdaccio), so nothing reaches
# npmjs.com: publishes the tarball with scripts/npm-publish.sh (twice; the second run must skip),
# then runs the release smoke test against that registry: npx, pnpm dlx, bunx, the `create`
# forms, both bins, the notices and MCP. The release workflow runs it on Linux and macOS.
# create-devstack-app is served only from the local storage; its dependencies are read through
# from npmjs.com (Verdaccio never publishes upstream).
#
#   sh scripts/npm-rehearse.sh <create-devstack-app-<version>.tgz>
#
# Needs Node, npm, pnpm and bun; your ~/.npmrc is not used or changed.
set -eu

VERDACCIO=verdaccio@6.10.4
PORT=${DEVSTACK_REHEARSE_PORT:-4873}
REGISTRY="http://127.0.0.1:$PORT/"

# Passed on as given, so the rehearsal publishes exactly as the release job does.
tarball=${1:?usage: sh scripts/npm-rehearse.sh <tarball>}
version=$(node -p 'require("./package.json").version')
work=$(mktemp -d)
server=''
cleanup() {
    if [ -n "$server" ]; then kill "$server" 2>/dev/null || true; fi
    rm -rf "$work"
}
trap cleanup EXIT INT TERM

cat > "$work/config.yaml" <<EOF
storage: $work/storage
max_body_size: 50mb
auth:
  htpasswd:
    file: $work/htpasswd
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  'create-devstack-app':
    access: \$all
    publish: \$authenticated
  '**':
    access: \$all
    proxy: npmjs
log: { type: stdout, format: pretty, level: warn }
EOF

npx --yes "$VERDACCIO" --config "$work/config.yaml" --listen "127.0.0.1:$PORT" > "$work/verdaccio.log" 2>&1 &
server=$!
tries=0
until curl -fsS "${REGISTRY}-/ping" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 120 ] || ! kill -0 "$server" 2>/dev/null; then
        cat "$work/verdaccio.log" >&2
        echo "npm-rehearse: the local registry did not start" >&2
        exit 1
    fi
    sleep 0.5
done

# A throwaway user on the throwaway registry, and an npm config that only knows about it.
token=$(curl -fsS -X PUT -H 'content-type: application/json' \
    -d '{"name":"rehearsal","password":"rehearsal-only"}' \
    "${REGISTRY}-/user/org.couchdb.user:rehearsal" | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>process.stdout.write(JSON.parse(s).token))')
NPM_CONFIG_USERCONFIG="$work/npmrc"
printf 'registry=%s\n//127.0.0.1:%s/:_authToken=%s\n' "$REGISTRY" "$PORT" "$token" > "$NPM_CONFIG_USERCONFIG"
# pnpm and bun read the registry from the environment
NPM_CONFIG_REGISTRY=$REGISTRY
export NPM_CONFIG_USERCONFIG NPM_CONFIG_REGISTRY
unset NPM_CONFIG_PROVENANCE NODE_AUTH_TOKEN

echo "--- publish"
sh scripts/npm-publish.sh "$tarball"
echo "--- publish again (must be skipped)"
again=$(sh scripts/npm-publish.sh "$tarball")
echo "$again"
case "$again" in
    *'already published'*) ;;
    *) echo "npm-rehearse: the second publish was not a no-op" >&2; exit 1 ;;
esac

echo "--- the published package, the ways users start it"
npx tsx tests/e2e/release-smoke.ts --registry "create-devstack-app@$version"
echo "npm-rehearse: ok"

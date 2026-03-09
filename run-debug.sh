#!/usr/bin/env bash
# Debug wrapper: captures stderr to /tmp/goodvibes-debug/ while preserving stdin/stdout for ACP
LOGDIR=/tmp/goodvibes-debug
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/stderr-$(date +%Y%m%d-%H%M%S).log"
exec /home/buzzkill/.bun/bin/bun run /home/buzzkill/Projects/goodvibes-acp/src/main.ts 2>"$LOGFILE"

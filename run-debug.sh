#!/bin/bash
# Debug wrapper — logs all stdin/stdout/stderr for ACP debugging
LOGDIR="/tmp/goodvibes-debug"
mkdir -p "$LOGDIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Tee stdin to a log, pass to bun; tee stdout to a log, pass to caller
exec 2>"$LOGDIR/stderr_$TIMESTAMP.log"
/home/buzzkill/.bun/bin/bun run /home/buzzkill/Projects/goodvibes-acp/src/main.ts \
  2>"$LOGDIR/stderr_$TIMESTAMP.log" \
  < <(tee "$LOGDIR/stdin_$TIMESTAMP.log") \
  | tee "$LOGDIR/stdout_$TIMESTAMP.log"

#!/bin/bash
# Mock bwrap for tests running on macOS
# It strips all bwrap arguments and executes the trailing command (lake env lean ... OR lean ...)

CMD=()
FOUND_BIN=0

for arg in "$@"; do
  # Check if we hit lake or lean to slice the command
  if [[ "$arg" == *"lake"* ]] || [[ "$arg" == *"lean"* ]]; then
    FOUND_BIN=1
  fi
  if [[ $FOUND_BIN -eq 1 ]]; then
    CMD+=("$arg")
  fi
done

if [[ ${#CMD[@]} -eq 0 ]]; then
  echo "mock_bwrap error: 'lake' or 'lean' not found in arguments"
  exit 1
fi

exec "${CMD[@]}"

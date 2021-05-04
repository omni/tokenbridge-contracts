#!/usr/bin/env bash

set -e

trap cleanup EXIT

cleanup() {
  if [ "$KEEP_RUNNING" != true ]; then
    docker-compose -f test/docker-compose.yml down
  fi
}
cleanup

ganache_running() {
  nc -z localhost 8545
}

if ganache_running; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance"
  docker-compose -f test/docker-compose.yml up -d ganache
  sleep 5
  echo "Deploy Compound protocol contracts"
  docker-compose -f test/docker-compose.yml up compound || true
fi

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node --max-old-space-size=4096 node_modules/.bin/truffle test 2>/dev/null; istanbul report lcov
else
  node_modules/.bin/truffle test --network ganache "$@"
fi

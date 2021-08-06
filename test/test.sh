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

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node --max-old-space-size=4096 node_modules/.bin/truffle run coverage --network ganache 2>/dev/null &
  pid=$!

  echo "Waiting in-process ganache to launch on port 8545"
  while ! ganache_running; do
    sleep 0.5
  done

  echo "Deploy Compound protocol contracts"
  PROVIDER=http://host.docker.internal:8545 docker-compose -f test/docker-compose.yml up compound || true

  wait $pid
else
  if ganache_running; then
    echo "Using existing ganache instance"
  else
    echo "Starting our own ganache instance"
    docker-compose -f test/docker-compose.yml up -d ganache
    sleep 5
    echo "Deploy Compound protocol contracts"
    PROVIDER=http://ganache:8545 docker-compose -f test/docker-compose.yml up compound || true
  fi
  node_modules/.bin/truffle test --network ganache "$@"
fi

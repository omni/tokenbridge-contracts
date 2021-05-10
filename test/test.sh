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

ENV_FILE=test/.env

if [ "$SOLIDITY_COVERAGE" = true ]; then
  source $ENV_FILE
  export ACCOUNTS
  node --max-old-space-size=4096 node_modules/.bin/truffle run coverage --network ganache --solcoverjs ./.solcover.js
else
  if ganache_running; then
    echo "Using existing ganache instance"
  else
    echo "Starting our own ganache instance"
    docker-compose -f test/docker-compose.yml --env-file $ENV_FILE up -d ganache
    sleep 5
    echo "Deploy Compound protocol contracts"
    docker-compose -f test/docker-compose.yml --env-file $ENV_FILE up compound || true
  fi
  node_modules/.bin/truffle test --network ganache "$@"
fi

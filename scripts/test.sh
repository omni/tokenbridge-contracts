#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit
node_modules/.bin/truffle version
# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

if [ "$SOLIDITY_COVERAGE" = true ]; then
  ganache_port=8555
else
  ganache_port=8545
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  # We define 10 accounts with balance 1M ether, needed for high-value tests.
  local accounts=(
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501200,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501202,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501203,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501204,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501205,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501206,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501207,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501208,1000000000000000000000000"
    --account="0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501209,1000000000000000000000000"
    --account="0x19fba401d77e4113b15095e9aa7117bcd25adcfac7f6111f8298894eef443600,1000000000000000000000000"
  )

  if [ "$SOLIDITY_COVERAGE" != true ]; then
    node_modules/.bin/ganache-cli --chainId 1337 --gasLimit 0xfffffffffff "${accounts[@]}" > /dev/null &
  fi

  ganache_pid=$!
}

if [ "$SOLIDITY_COVERAGE" != true ]; then
    if ganache_running; then
      echo "Using existing ganache instance"
    else
      echo "Starting our own ganache instance"
      start_ganache
    fi
fi

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node --max-old-space-size=4096 node_modules/.bin/truffle test 2>/dev/null; istanbul report lcov
else
  node_modules/.bin/truffle test --network ganache  "$@"
fi

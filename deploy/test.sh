#!/bin/bash

set -e

RPC_URL="https://mainnet.infura.io/v3/..."

docker kill ganache || true
docker rm ganache || true

sleep 1

docker run --rm -d --name ganache -p 8545:8545 trufflesuite/ganache-cli --fork "$RPC_URL" --gasLimit 12500000 --verbose -d -u "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6" --noVMErrorsOnRPCResponse
cd ..
npm run compile
cd deploy

node test.js

docker kill ganache

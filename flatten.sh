#!/usr/bin/env bash

if [ ! -d "flats" ]; then
	mkdir flats
fi

rm -rf flats/*
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/U_ForeignBridge.sol > flats/ForeignBridge_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/U_BridgeValidators.sol > flats/BridgeValidators_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/U_HomeBridge.sol > flats/HomeBridge_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
./node_modules/.bin/truffle-flattener contracts/POA20.sol > flats/POA20_flat.sol

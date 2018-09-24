#!/usr/bin/env bash

rm -rf flats/*
mkdir -p flats/native_to_erc20
mkdir -p flats/erc20_to_erc20

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/native_to_erc20/ForeignBridgeNativeToErc.sol > flats/native_to_erc20/ForeignBridgeNativeToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/native_to_erc20/HomeBridgeNativeToErc.sol > flats/native_to_erc20/HomeBridgeNativeToErc_flat.sol

./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/HomeBridgeErcToErc.sol > flats/erc20_to_erc20/HomeBridgeErcToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeable_contracts/erc20_to_erc20/ForeignBridgeErcToErc.sol > flats/erc20_to_erc20/ForeignBridgeErcToErc_flat.sol
./node_modules/.bin/truffle-flattener contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
./node_modules/.bin/truffle-flattener contracts/ERC677BridgeToken.sol > flats/ERC677BridgeToken_flat.sol

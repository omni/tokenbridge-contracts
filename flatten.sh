#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir -p flats/native_to_erc20
mkdir -p flats/erc20_to_erc20
mkdir -p flats/erc20_to_native
mkdir -p flats/validators

FLATTENER=./node_modules/.bin/truffle-flattener
BRIDGE_CONTRACTS_DIR=contracts/upgradeable_contracts
VALIDATOR_CONTRACTS_DIR=contracts/upgradeable_contracts

echo "Flattening common bridge contracts"
${FLATTENER} contracts/upgradeability/EternalStorageProxy.sol > flats/EternalStorageProxy_flat.sol
${FLATTENER} contracts/upgradeability/ClassicEternalStorageProxy.sol > flats/ClassicEternalStorageProxy_flat.sol
${FLATTENER} contracts/ERC677BridgeToken.sol > flats/ERC677BridgeToken_flat.sol
${FLATTENER} contracts/ERC677BridgeTokenRewardable.sol > flats/ERC677BridgeTokenRewardable_flat.sol

echo "Flattening bridge validators contracts"
${FLATTENER} ${VALIDATOR_CONTRACTS_DIR}/BridgeValidators.sol > flats/validators/BridgeValidators_flat.sol
${FLATTENER} ${VALIDATOR_CONTRACTS_DIR}/RewardableValidators.sol > flats/validators/RewardableValidators_flat.sol

echo "Flattening contracts related to native-to-erc bridge"
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/native_to_erc20/ForeignBridgeNativeToErc.sol > flats/native_to_erc20/ForeignBridgeNativeToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/native_to_erc20/HomeBridgeNativeToErc.sol > flats/native_to_erc20/HomeBridgeNativeToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/native_to_erc20/ClassicHomeBridgeNativeToErc.sol > flats/native_to_erc20/ClassicHomeBridgeNativeToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/native_to_erc20/FeeManagerNativeToErc.sol > flats/native_to_erc20/FeeManagerNativeToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/native_to_erc20/FeeManagerNativeToErcBothDirections.sol > flats/native_to_erc20/FeeManagerNativeToErcBothDirections_flat.sol

echo "Flattening contracts related to erc-to-erc bridge"
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_erc20/HomeBridgeErcToErc.sol > flats/erc20_to_erc20/HomeBridgeErcToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_erc20/HomeBridgeErcToErcPOSDAO.sol > flats/erc20_to_erc20/HomeBridgeErcToErcPOSDAO_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_erc20/ForeignBridgeErcToErc.sol > flats/erc20_to_erc20/ForeignBridgeErcToErc_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_erc20/ForeignBridgeErc677ToErc677.sol > flats/erc20_to_erc20/ForeignBridgeErc677ToErc677_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_erc20/FeeManagerErcToErcPOSDAO.sol > flats/erc20_to_erc20/FeeManagerErcToErcPOSDAO_flat.sol

echo "Flattening contracts related to erc-to-native bridge"
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_native/HomeBridgeErcToNative.sol > flats/erc20_to_native/HomeBridgeErcToNative_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_native/ForeignBridgeErcToNative.sol > flats/erc20_to_native/ForeignBridgeErcToNative_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_native/FeeManagerErcToNative.sol > flats/erc20_to_native/FeeManagerErcToNative_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/erc20_to_native/FeeManagerErcToNativePOSDAO.sol > flats/erc20_to_native/FeeManagerErcToNativePOSDAO_flat.sol



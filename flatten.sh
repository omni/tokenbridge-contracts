#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir -p flats/native_to_erc20
mkdir -p flats/erc20_to_erc20
mkdir -p flats/erc20_to_native
mkdir -p flats/validators
mkdir -p flats/arbitrary_message
mkdir -p flats/amb_erc677_to_erc677

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

echo "Flattening contracts related to arbitrary-message bridge"
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/arbitrary_message/HomeAMB.sol > flats/arbitrary_message/HomeAMB_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/arbitrary_message/ForeignAMB.sol > flats/arbitrary_message/ForeignAMB_flat.sol

echo "Flattening contracts related to erc677 to erc677 on top of AMB bridge"
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/amb_erc677_to_erc677/HomeAMBErc677ToErc677.sol > flats/amb_erc677_to_erc677/HomeAMBErc677ToErc677_flat.sol
${FLATTENER} ${BRIDGE_CONTRACTS_DIR}/amb_erc677_to_erc677/ForeignAMBErc677ToErc677.sol > flats/amb_erc677_to_erc677/ForeignAMBErc677ToErc677_flat.sol

/* eslint import/no-dynamic-require: 0 */
const { HOME_EVM_VERSION, FOREIGN_EVM_VERSION } = require('./loadEnv')
const { EVM_TYPES } = require('./constants')

const homeContracts = getContracts(HOME_EVM_VERSION)
const foreignContracts = getContracts(FOREIGN_EVM_VERSION)

function getContracts(evmVersion) {
  const buildPath = evmVersion === EVM_TYPES.SPURIOUSDRAGON ? 'spuriousDragon' : 'contracts'
  const useClassicProxy = evmVersion === EVM_TYPES.SPURIOUSDRAGON
  return {
    EternalStorageProxy: useClassicProxy
      ? require(`../../build/${buildPath}/ClassicEternalStorageProxy.json`)
      : require(`../../build/${buildPath}/EternalStorageProxy.json`),
    BridgeValidators: require(`../../build/${buildPath}/BridgeValidators.json`),
    RewardableValidators: require(`../../build/${buildPath}/RewardableValidators.json`),
    FeeManagerErcToErcPOSDAO: require(`../../build/${buildPath}/FeeManagerErcToErcPOSDAO.json`),
    HomeBridgeErcToErc: require(`../../build/${buildPath}/HomeBridgeErcToErc.json`),
    ForeignBridgeErcToErc: require(`../../build/${buildPath}/ForeignBridgeErcToErc.json`),
    ForeignBridgeErc677ToErc677: require(`../../build/${buildPath}/ForeignBridgeErc677ToErc677.json`),
    HomeBridgeErcToErcPOSDAO: require(`../../build/${buildPath}/HomeBridgeErcToErcPOSDAO.json`),
    ERC677BridgeToken: require(`../../build/${buildPath}/ERC677BridgeToken.json`),
    ERC677BridgeTokenRewardable: require(`../../build/${buildPath}/ERC677BridgeTokenRewardable.json`),
    ForeignBridgeErcToNative: require(`../../build/${buildPath}/ForeignBridgeErcToNative.json`),
    FeeManagerErcToNative: require(`../../build/${buildPath}/FeeManagerErcToNative.json`),
    FeeManagerErcToNativePOSDAO: require(`../../build/${buildPath}/FeeManagerErcToNativePOSDAO.json`),
    HomeBridgeErcToNative: require(`../../build/${buildPath}/HomeBridgeErcToNative.json`),
    FeeManagerNativeToErc: require(`../../build/${buildPath}/FeeManagerNativeToErc.json`),
    ForeignBridgeNativeToErc: require(`../../build/${buildPath}/ForeignBridgeNativeToErc.json`),
    FeeManagerNativeToErcBothDirections: require(`../../build/${buildPath}/FeeManagerNativeToErcBothDirections.json`),
    HomeBridgeNativeToErc: useClassicProxy
      ? require(`../../build/${buildPath}/ClassicHomeBridgeNativeToErc.json`)
      : require(`../../build/${buildPath}/HomeBridgeNativeToErc.json`),
    BlockReward: require(`../../build/${buildPath}/BlockReward.json`)
  }
}

module.exports = {
  homeContracts,
  foreignContracts
}

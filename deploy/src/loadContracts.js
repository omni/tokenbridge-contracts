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
    HomeBridgeErcToErcRelativeDailyLimit: require(`../../build/${buildPath}/HomeBridgeErcToErcRelativeDailyLimit.json`),
    ForeignBridgeErcToErc: require(`../../build/${buildPath}/ForeignBridgeErcToErc.json`),
    ForeignBridgeErcToErcRelativeDailyLimit: require(`../../build/${buildPath}/ForeignBridgeErcToErcRelativeDailyLimit.json`),
    ForeignBridgeErc677ToErc677: require(`../../build/${buildPath}/ForeignBridgeErc677ToErc677.json`),
    ForeignBridgeErc677ToErc677RelativeDailyLimit: require(`../../build/${buildPath}/ForeignBridgeErc677ToErc677RelativeDailyLimit.json`),
    HomeBridgeErcToErcPOSDAO: require(`../../build/${buildPath}/HomeBridgeErcToErcPOSDAO.json`),
    HomeBridgeErcToErcPOSDAORelativeDailyLimit: require(`../../build/${buildPath}/HomeBridgeErcToErcPOSDAORelativeDailyLimit.json`),
    ERC677BridgeToken: require(`../../build/${buildPath}/ERC677BridgeToken.json`),
    ERC677BridgeTokenRewardable: require(`../../build/${buildPath}/ERC677BridgeTokenRewardable.json`),
    ForeignBridgeErcToNative: require(`../../build/${buildPath}/ForeignBridgeErcToNative.json`),
    ForeignBridgeErcToNativeRelativeDailyLimit: require(`../../build/${buildPath}/ForeignBridgeErcToNativeRelativeDailyLimit.json`),
    FeeManagerErcToNative: require(`../../build/${buildPath}/FeeManagerErcToNative.json`),
    FeeManagerErcToNativePOSDAO: require(`../../build/${buildPath}/FeeManagerErcToNativePOSDAO.json`),
    HomeBridgeErcToNative: require(`../../build/${buildPath}/HomeBridgeErcToNative.json`),
    HomeBridgeErcToNativeRelativeDailyLimit: require(`../../build/${buildPath}/HomeBridgeErcToNativeRelativeDailyLimit.json`),
    FeeManagerNativeToErc: require(`../../build/${buildPath}/FeeManagerNativeToErc.json`),
    ForeignBridgeNativeToErc: require(`../../build/${buildPath}/ForeignBridgeNativeToErc.json`),
    ForeignBridgeNativeToErcRelativeDailyLimit: require(`../../build/${buildPath}/ForeignBridgeNativeToErcRelativeDailyLimit.json`),
    FeeManagerNativeToErcBothDirections: require(`../../build/${buildPath}/FeeManagerNativeToErcBothDirections.json`),
    HomeBridgeNativeToErc: useClassicProxy
      ? require(`../../build/${buildPath}/ClassicHomeBridgeNativeToErc.json`)
      : require(`../../build/${buildPath}/HomeBridgeNativeToErc.json`),
    HomeBridgeNativeToErcRelativeDailyLimit: useClassicProxy
      ? require(`../../build/${buildPath}/ClassicHomeBridgeNativeToErcRelativeDailyLimit.json`)
      : require(`../../build/${buildPath}/HomeBridgeNativeToErcRelativeDailyLimit.json`),
    BlockReward: require(`../../build/${buildPath}/BlockReward.json`),
    HomeAMB: require(`../../build/${buildPath}/HomeAMB.json`),
    ForeignAMB: require(`../../build/${buildPath}/ForeignAMB`),
    HomeAMBErc677ToErc677: require(`../../build/${buildPath}/HomeAMBErc677ToErc677.json`),
    ForeignAMBErc677ToErc677: require(`../../build/${buildPath}/ForeignAMBErc677ToErc677.json`)
  }
}

module.exports = {
  homeContracts,
  foreignContracts
}

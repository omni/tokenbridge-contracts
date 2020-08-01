/* eslint import/no-dynamic-require: 0 */
const homeContracts = getContracts()
const foreignContracts = getContracts()

function getContracts() {
  const buildPath = 'contracts'
  return {
    EternalStorageProxy: require(`../../build/${buildPath}/EternalStorageProxy.json`),
    BridgeValidators: require(`../../build/${buildPath}/BridgeValidators.json`),
    RewardableValidators: require(`../../build/${buildPath}/RewardableValidators.json`),
    FeeManagerErcToErcPOSDAO: require(`../../build/${buildPath}/FeeManagerErcToErcPOSDAO.json`),
    HomeBridgeErcToErc: require(`../../build/${buildPath}/HomeBridgeErcToErc.json`),
    ForeignBridgeErcToErc: require(`../../build/${buildPath}/ForeignBridgeErcToErc.json`),
    ForeignBridgeErc677ToErc677: require(`../../build/${buildPath}/ForeignBridgeErc677ToErc677.json`),
    HomeBridgeErcToErcPOSDAO: require(`../../build/${buildPath}/HomeBridgeErcToErcPOSDAO.json`),
    ERC677BridgeToken: require(`../../build/${buildPath}/ERC677BridgeToken.json`),
    ERC677BridgeTokenRewardable: require(`../../build/${buildPath}/ERC677BridgeTokenRewardable.json`),
    ERC677BridgeTokenPermittable: require(`../../build/${buildPath}/PermittableToken.json`),
    ForeignBridgeErcToNative: require(`../../build/${buildPath}/ForeignBridgeErcToNative.json`),
    FeeManagerErcToNative: require(`../../build/${buildPath}/FeeManagerErcToNative.json`),
    FeeManagerErcToNativePOSDAO: require(`../../build/${buildPath}/FeeManagerErcToNativePOSDAO.json`),
    HomeBridgeErcToNative: require(`../../build/${buildPath}/HomeBridgeErcToNative.json`),
    FeeManagerNativeToErc: require(`../../build/${buildPath}/FeeManagerNativeToErc.json`),
    ForeignBridgeNativeToErc: require(`../../build/${buildPath}/ForeignBridgeNativeToErc.json`),
    FeeManagerNativeToErcBothDirections: require(`../../build/${buildPath}/FeeManagerNativeToErcBothDirections.json`),
    HomeBridgeNativeToErc: require(`../../build/${buildPath}/HomeBridgeNativeToErc.json`),
    BlockReward: require(`../../build/${buildPath}/BlockReward.json`),
    BlockRewardMock: require(`../../build/${buildPath}/BlockRewardMock.json`),
    HomeAMB: require(`../../build/${buildPath}/HomeAMB.json`),
    ForeignAMB: require(`../../build/${buildPath}/ForeignAMB`),
    HomeAMBErc677ToErc677: require(`../../build/${buildPath}/HomeAMBErc677ToErc677.json`),
    ForeignAMBErc677ToErc677: require(`../../build/${buildPath}/ForeignAMBErc677ToErc677.json`),
    InterestReceiver: require(`../../build/${buildPath}/InterestReceiver.json`),
    HomeStakeTokenMediator: require(`../../build/${buildPath}/HomeStakeTokenMediator.json`),
    ForeignStakeTokenMediator: require(`../../build/${buildPath}/ForeignStakeTokenMediator.json`),
    HomeAMBNativeToErc20: require(`../../build/${buildPath}/HomeAMBNativeToErc20.json`),
    ForeignAMBNativeToErc20: require(`../../build/${buildPath}/ForeignAMBNativeToErc20.json`),
    HomeFeeManagerAMBNativeToErc20: require(`../../build/${buildPath}/HomeFeeManagerAMBNativeToErc20.json`),
    ForeignFeeManagerAMBNativeToErc20: require(`../../build/${buildPath}/ForeignFeeManagerAMBNativeToErc20.json`),
    ForeignAMBErc20ToNative: require(`../../build/${buildPath}/ForeignAMBErc20ToNative.json`),
    HomeAMBErc20ToNative: require(`../../build/${buildPath}/HomeAMBErc20ToNative.json`),
    ForeignMultiAMBErc20ToErc677: require(`../../build/${buildPath}/ForeignMultiAMBErc20ToErc677.json`),
    HomeMultiAMBErc20ToErc677: require(`../../build/${buildPath}/HomeMultiAMBErc20ToErc677.json`),
  }
}

module.exports = {
  homeContracts,
  foreignContracts
}

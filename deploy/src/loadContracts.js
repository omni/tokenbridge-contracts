/* eslint import/no-dynamic-require: 0 */
const homeContracts = getContracts()
const foreignContracts = getContracts()

function getContracts() {
  const buildPath = 'contracts'
  return {
    EternalStorageProxy: require(`../../build/${buildPath}/EternalStorageProxy.json`),
    BridgeValidators: require(`../../build/${buildPath}/BridgeValidators.json`),
    RewardableValidators: require(`../../build/${buildPath}/RewardableValidators.json`),
    ERC677BridgeToken: require(`../../build/${buildPath}/ERC677BridgeToken.json`),
    ERC677BridgeTokenRewardable: require(`../../build/${buildPath}/ERC677BridgeTokenRewardable.json`),
    ERC677BridgeTokenPermittable: require(`../../build/${buildPath}/PermittableToken.json`),
    ForeignBridgeErcToNative: require(`../../build/${buildPath}/ForeignBridgeErcToNative.json`),
    FeeManagerErcToNative: require(`../../build/${buildPath}/FeeManagerErcToNative.json`),
    FeeManagerErcToNativePOSDAO: require(`../../build/${buildPath}/FeeManagerErcToNativePOSDAO.json`),
    HomeBridgeErcToNative: require(`../../build/${buildPath}/HomeBridgeErcToNative.json`),
    BlockRewardMock: require(`../../build/${buildPath}/BlockRewardMock.json`),
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

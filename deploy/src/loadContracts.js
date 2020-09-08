/* eslint import/no-dynamic-require: 0 */
const homeContracts = getContracts()
const foreignContracts = getContracts()

function getContracts() {
  const buildPath = '../../contracts/build/contracts'
  const getArtifact = name => require(`${buildPath}/${name}.json`)
  return {
    EternalStorageProxy: getArtifact('EternalStorageProxy'),
    BridgeValidators: getArtifact('BridgeValidators'),
    RewardableValidators: getArtifact('RewardableValidators'),
    FeeManagerErcToErcPOSDAO: getArtifact('FeeManagerErcToErcPOSDAO'),
    HomeBridgeErcToErc: getArtifact('HomeBridgeErcToErc'),
    ForeignBridgeErcToErc: getArtifact('ForeignBridgeErcToErc'),
    ForeignBridgeErc677ToErc677: getArtifact('ForeignBridgeErc677ToErc677'),
    HomeBridgeErcToErcPOSDAO: getArtifact('HomeBridgeErcToErcPOSDAO'),
    ERC677BridgeToken: getArtifact('ERC677BridgeToken'),
    ERC677BridgeTokenRewardable: getArtifact('ERC677BridgeTokenRewardable'),
    ERC677BridgeTokenPermittable: getArtifact('PermittableToken'),
    ForeignBridgeErcToNative: getArtifact('ForeignBridgeErcToNative'),
    FeeManagerErcToNative: getArtifact('FeeManagerErcToNative'),
    FeeManagerErcToNativePOSDAO: getArtifact('FeeManagerErcToNativePOSDAO'),
    HomeBridgeErcToNative: getArtifact('HomeBridgeErcToNative'),
    FeeManagerNativeToErc: getArtifact('FeeManagerNativeToErc'),
    ForeignBridgeNativeToErc: getArtifact('ForeignBridgeNativeToErc'),
    FeeManagerNativeToErcBothDirections: getArtifact('FeeManagerNativeToErcBothDirections'),
    HomeBridgeNativeToErc: getArtifact('HomeBridgeNativeToErc'),
    BlockReward: getArtifact('BlockReward'),
    BlockRewardMock: getArtifact('BlockRewardMock'),
    HomeAMB: getArtifact('HomeAMB'),
    ForeignAMB: getArtifact('ForeignAMB'),
    HomeAMBErc677ToErc677: getArtifact('HomeAMBErc677ToErc677'),
    ForeignAMBErc677ToErc677: getArtifact('ForeignAMBErc677ToErc677'),
    InterestReceiver: getArtifact('InterestReceiver'),
    HomeStakeTokenMediator: getArtifact('HomeStakeTokenMediator'),
    ForeignStakeTokenMediator: getArtifact('ForeignStakeTokenMediator'),
    HomeAMBNativeToErc20: getArtifact('HomeAMBNativeToErc20'),
    ForeignAMBNativeToErc20: getArtifact('ForeignAMBNativeToErc20'),
    HomeFeeManagerAMBNativeToErc20: getArtifact('HomeFeeManagerAMBNativeToErc20'),
    ForeignFeeManagerAMBNativeToErc20: getArtifact('ForeignFeeManagerAMBNativeToErc20'),
    ForeignAMBErc20ToNative: getArtifact('ForeignAMBErc20ToNative'),
    HomeAMBErc20ToNative: getArtifact('HomeAMBErc20ToNative'),
    ForeignMultiAMBErc20ToErc677: getArtifact('ForeignMultiAMBErc20ToErc677'),
    HomeMultiAMBErc20ToErc677: getArtifact('HomeMultiAMBErc20ToErc677')
  }
}

module.exports = {
  homeContracts,
  foreignContracts
}

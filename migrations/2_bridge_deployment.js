const POA20 = artifacts.require("./POA20.sol");
const BridgeValidators = artifacts.require("./BridgeValidators.sol");
const HomeBridge = artifacts.require("./HomeBridge.sol");
const ForeignBridge = artifacts.require("./ForeignBridge.sol");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(POA20, "POA ERC20 on Foundation", "POA20", 18)
  const erc677token = await POA20.deployed()
  await deployer.deploy(BridgeValidators, '1', [accounts[0]]);
  const validatorContract = await BridgeValidators.deployed();
  await deployer.deploy(HomeBridge, validatorContract.address);
  await deployer.deploy(ForeignBridge, validatorContract.address, erc677token.address);
  const foreignBridge = await ForeignBridge.deployed();

  await erc677token.transferOwnership(foreignBridge.address)
  console.log('all is done')

};

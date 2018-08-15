const fs = require('fs');
require('dotenv').config();

async function deployNativeToErc(){
  const deployHome = require('./src/native_to_erc/home');
  const deployForeign = require('./src/native_to_erc/foreign');

  const homeBridge = await deployHome()
  const {foreignBridge, erc677} = await deployForeign();
  console.log("\nDeployment has been completed.\n\n")
  console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] POA20: ${erc677.address}`)
  fs.writeFileSync('./bridgeDeploymentResults.json', JSON.stringify({
    homeBridge: {
      ...homeBridge,
    },foreignBridge: {
      ...foreignBridge,
    },erc677
  },null,4));
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function deployErcToErc() {
  const deployHome = require('./src/erc_to_erc/home');
  const deployForeign = require('./src/erc_to_erc/foreign');

  const {homeBridgeAddress, erc677tokenAddress, deployedBlockNumber} = await deployHome()
  const {foreignBridge} = await deployForeign();
  console.log("\nDeployment has been completed.\n\n")
  console.log(`[   Home  ] HomeBridge: ${homeBridgeAddress} at block ${deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ERC20 Token: ${process.env.ERC20_TOKEN_ADDRESS}`)
  console.log(`[ Home ] ERC677 Bridgeble Token: ${erc677tokenAddress}`)
  fs.writeFileSync('./bridgeDeploymentResults.json', JSON.stringify({
    homeBridge: {
      homeBridgeAddress,
      erc677tokenAddress
    },foreignBridge: {
      ...foreignBridge,
    }
  },null,4));
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function main() {
  const BRIDGE_MODE = process.env.BRIDGE_MODE;
  console.log(`Bridge mode: ${BRIDGE_MODE}`)
  switch(BRIDGE_MODE) {
    case "NATIVE_TO_ERC":
      await deployNativeToErc();
      break;
    case "ERC_TO_ERC":
      await deployErcToErc();
      break;
    default:
      console.log(BRIDGE_MODE)
      throw "Please specify BRIDGE_MODE: NATIVE_TO_ERC or ERC_TO_ERC"
  }
}

main().catch(e => console.log('Error:', e))

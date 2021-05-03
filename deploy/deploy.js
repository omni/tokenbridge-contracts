const fs = require('fs')
const path = require('path')
const env = require('./src/loadEnv')

const { BRIDGE_MODE, ERC20_TOKEN_ADDRESS } = env

const deployResultsPath = path.join(__dirname, './bridgeDeploymentResults.json')

function writeDeploymentResults(data) {
  fs.writeFileSync(deployResultsPath, JSON.stringify(data, null, 4))
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function deployErcToNative() {
  const preDeploy = require('./src/erc_to_native/preDeploy')
  const deployHome = require('./src/erc_to_native/home')
  const deployForeign = require('./src/erc_to_native/foreign')
  await preDeploy()
  const { homeBridge } = await deployHome()
  const { foreignBridge } = await deployForeign(homeBridge.address)
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[ Home ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  writeDeploymentResults({
    homeBridge: {
      ...homeBridge
    },
    foreignBridge: {
      ...foreignBridge
    }
  })
}

async function deployArbitraryMessage() {
  const preDeploy = require('./src/arbitrary_message/preDeploy')
  const deployHome = require('./src/arbitrary_message/home')
  const deployForeign = require('./src/arbitrary_message/foreign')
  await preDeploy()
  const { homeBridge } = await deployHome()
  const { foreignBridge } = await deployForeign()
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  writeDeploymentResults({
    homeBridge: {
      ...homeBridge
    },
    foreignBridge: {
      ...foreignBridge
    }
  })
}

async function deployAMBErcToErc() {
  const preDeploy = require('./src/amb_erc677_to_erc677/preDeploy')
  const deployHome = require('./src/amb_erc677_to_erc677/home')
  const deployForeign = require('./src/amb_erc677_to_erc677/foreign')
  const initialize = require('./src/amb_erc677_to_erc677/initialize')
  await preDeploy()
  const { homeBridgeMediator, bridgeableErc677 } = await deployHome()
  const { foreignBridgeMediator } = await deployForeign()
  await initialize({
    homeBridge: homeBridgeMediator.address,
    foreignBridge: foreignBridgeMediator.address,
    homeErc677: bridgeableErc677.address
  })
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] Bridge Mediator: ${homeBridgeMediator.address}`)
  console.log(`[   Home  ] ERC677 Bridgeable Token: ${bridgeableErc677.address}`)
  console.log(`[ Foreign ] Bridge Mediator: ${foreignBridgeMediator.address}`)
  console.log(`[ Foreign ] ERC677 Token: ${ERC20_TOKEN_ADDRESS}`)
  writeDeploymentResults({
    homeBridge: {
      homeBridgeMediator,
      bridgeableErc677
    },
    foreignBridge: {
      foreignBridgeMediator
    }
  })
}

async function main() {
  console.log(`Bridge mode: ${BRIDGE_MODE}`)
  switch (BRIDGE_MODE) {
    case 'ERC_TO_NATIVE':
      await deployErcToNative()
      break
    case 'ARBITRARY_MESSAGE':
      await deployArbitraryMessage()
      break
    case 'AMB_ERC_TO_ERC':
      await deployAMBErcToErc()
      break
    default:
      console.log(BRIDGE_MODE)
      throw new Error('Please specify BRIDGE_MODE: ERC_TO_NATIVE or ARBITRARY_MESSAGE or AMB_ERC_TO_ERC')
  }
}

main().catch(e => console.log('Error:', e))

const fs = require('fs')
const path = require('path')
const env = require('./src/loadEnv')

const { BRIDGE_MODE, ERC20_TOKEN_ADDRESS } = env

const deployResultsPath = path.join(__dirname, './bridgeDeploymentResults.json')

function writeDeploymentResults(data) {
  fs.writeFileSync(deployResultsPath, JSON.stringify(data, null, 4))
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function deployNativeToErc() {
  const preDeploy = require('./src/native_to_erc/preDeploy')
  const deployHome = require('./src/native_to_erc/home')
  const deployForeign = require('./src/native_to_erc/foreign')
  await preDeploy()
  const { homeBridge } = await deployHome()
  const { foreignBridge, erc677 } = await deployForeign(homeBridge.address)
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ERC677 Bridgeable Token: ${erc677.address}`)
  writeDeploymentResults({
    homeBridge: {
      ...homeBridge
    },
    foreignBridge: {
      ...foreignBridge,
      erc677
    }
  })
}

async function deployErcToErc() {
  const preDeploy = require('./src/erc_to_erc/preDeploy')
  const deployHome = require('./src/erc_to_erc/home')
  const deployForeign = require('./src/erc_to_erc/foreign')
  await preDeploy()
  const { homeBridge, erc677 } = await deployHome()
  const { foreignBridge } = await deployForeign()
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`)
  console.log(`[   Home  ] ERC677 Bridgeable Token: ${erc677.address}`)
  console.log(`[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${foreignBridge.deployedBlockNumber}`)
  console.log(`[ Foreign ] ERC20 Token: ${ERC20_TOKEN_ADDRESS}`)
  writeDeploymentResults({
    homeBridge: {
      ...homeBridge,
      erc677
    },
    foreignBridge: {
      ...foreignBridge
    }
  })
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

async function deployStakeAMBErcToErc() {
  const preDeploy = require('./src/stake_token_mediators/preDeploy')
  const deployHome = require('./src/stake_token_mediators/home')
  const deployForeign = require('./src/stake_token_mediators/foreign')
  const initialize = require('./src/stake_token_mediators/initialize')
  await preDeploy()
  const { homeBridgeMediator } = await deployHome()
  const { foreignBridgeMediator } = await deployForeign()
  await initialize({ homeBridge: homeBridgeMediator.address, foreignBridge: foreignBridgeMediator.address })
  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] Bridge Mediator: ${homeBridgeMediator.address}`)
  console.log(`[ Foreign ] Bridge Mediator: ${foreignBridgeMediator.address}`)
  writeDeploymentResults({
    homeBridge: {
      homeBridgeMediator
    },
    foreignBridge: {
      foreignBridgeMediator
    }
  })
}

async function deployAMBNativeToErc() {
  const preDeploy = require('./src/amb_native_to_erc20/preDeploy')
  const deployHome = require('./src/amb_native_to_erc20/home')
  const deployForeign = require('./src/amb_native_to_erc20/foreign')
  const initializeHome = require('./src/amb_native_to_erc20/initializeHome')
  const initializeForeign = require('./src/amb_native_to_erc20/initializeForeign')
  await preDeploy()
  const { homeBridgeMediator, homeFeeManager } = await deployHome()
  const { foreignBridgeMediator, bridgeableErc677, foreignFeeManager } = await deployForeign()

  await initializeHome({
    homeBridge: homeBridgeMediator.address,
    homeFeeManager: homeFeeManager.address,
    foreignBridge: foreignBridgeMediator.address
  })

  await initializeForeign({
    foreignBridge: foreignBridgeMediator.address,
    foreignFeeManager: foreignFeeManager.address,
    foreignErc677: bridgeableErc677.address,
    homeBridge: homeBridgeMediator.address
  })

  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] Bridge Mediator: ${homeBridgeMediator.address}`)
  if (homeFeeManager.address) {
    console.log(`[   Home  ] Fee Manager: ${homeFeeManager.address}`)
  }
  console.log(`[ Foreign ] Bridge Mediator: ${foreignBridgeMediator.address}`)
  if (foreignFeeManager.address) {
    console.log(`[ Foreign ] Fee Manager: ${foreignFeeManager.address}`)
  }
  console.log(`[ Foreign ] ERC677 Token: ${bridgeableErc677.address}`)
  writeDeploymentResults({
    homeBridge: {
      homeBridgeMediator,
      homeFeeManager
    },
    foreignBridge: {
      foreignBridgeMediator,
      foreignFeeManager,
      bridgeableErc677
    }
  })
}

async function deployAMBErcToNative() {
  const preDeploy = require('./src/amb_erc20_to_native/preDeploy')
  const deployHome = require('./src/amb_erc20_to_native/home')
  const deployForeign = require('./src/amb_erc20_to_native/foreign')
  const initializeHome = require('./src/amb_erc20_to_native/initializeHome')
  const initializeForeign = require('./src/amb_erc20_to_native/initializeForeign')
  await preDeploy()
  const { homeBridgeMediator } = await deployHome()
  const { foreignBridgeMediator } = await deployForeign()

  await initializeHome({
    homeBridge: homeBridgeMediator.address,
    foreignBridge: foreignBridgeMediator.address
  })

  await initializeForeign({
    foreignBridge: foreignBridgeMediator.address,
    homeBridge: homeBridgeMediator.address
  })

  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] Bridge Mediator: ${homeBridgeMediator.address}`)
  console.log(`[ Foreign ] Bridge Mediator: ${foreignBridgeMediator.address}`)
  writeDeploymentResults({
    homeBridge: {
      homeBridgeMediator
    },
    foreignBridge: {
      foreignBridgeMediator
    }
  })
}

async function deployMultiAMBErcToErc() {
  const preDeploy = require('./src/multi_amb_erc20_to_erc677/preDeploy')
  const deployHome = require('./src/multi_amb_erc20_to_erc677/home')
  const deployForeign = require('./src/multi_amb_erc20_to_erc677/foreign')
  const initializeHome = require('./src/multi_amb_erc20_to_erc677/initializeHome')
  const initializeForeign = require('./src/multi_amb_erc20_to_erc677/initializeForeign')
  await preDeploy()
  const { homeBridgeMediator, homeTokenImage } = await deployHome()
  const { foreignBridgeMediator } = await deployForeign()

  await initializeHome({
    homeBridge: homeBridgeMediator.address,
    foreignBridge: foreignBridgeMediator.address,
    homeTokenImage: homeTokenImage.address
  })

  await initializeForeign({
    foreignBridge: foreignBridgeMediator.address,
    homeBridge: homeBridgeMediator.address
  })

  console.log('\nDeployment has been completed.\n\n')
  console.log(`[   Home  ] Bridge Mediator: ${homeBridgeMediator.address}`)
  console.log(`[ Foreign ] Bridge Mediator: ${foreignBridgeMediator.address}`)
  writeDeploymentResults({
    homeBridge: {
      homeBridgeMediator
    },
    foreignBridge: {
      foreignBridgeMediator
    }
  })
}

async function main() {
  console.log(`Bridge mode: ${BRIDGE_MODE}`)
  switch (BRIDGE_MODE) {
    case 'NATIVE_TO_ERC':
      await deployNativeToErc()
      break
    case 'ERC_TO_ERC':
      await deployErcToErc()
      break
    case 'ERC_TO_NATIVE':
      await deployErcToNative()
      break
    case 'ARBITRARY_MESSAGE':
      await deployArbitraryMessage()
      break
    case 'AMB_ERC_TO_ERC':
      await deployAMBErcToErc()
      break
    case 'STAKE_AMB_ERC_TO_ERC':
      await deployStakeAMBErcToErc()
      break
    case 'AMB_NATIVE_TO_ERC':
      await deployAMBNativeToErc()
      break
    case 'AMB_ERC_TO_NATIVE':
      await deployAMBErcToNative()
      break
    case 'MULTI_AMB_ERC_TO_ERC':
      await deployMultiAMBErcToErc()
      break
    default:
      console.log(BRIDGE_MODE)
      throw new Error('Please specify BRIDGE_MODE: NATIVE_TO_ERC or ERC_TO_ERC')
  }
}

main().catch(e => console.log('Error:', e))

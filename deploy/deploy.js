const fs = require('fs')
const path = require('path')
const env = require('./src/loadEnv')

const { BRIDGE_MODE, ERC20_TOKEN_ADDRESS } = env

const deployResultsPath = path.join(__dirname, './bridgeDeploymentResults.json')

async function deployNativeToErc() {
  const deployHome = require('./src/native_to_erc/home')
  const deployForeign = require('./src/native_to_erc/foreign')

  const { homeBridge } = await deployHome()
  const { foreignBridge, erc677 } = await deployForeign()
  console.log('\nDeployment has been completed.\n\n')
  console.log(
    `[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`
  )
  console.log(
    `[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${
      foreignBridge.deployedBlockNumber
    }`
  )
  console.log(`[ Foreign ] ERC677 Bridgeable Token: ${erc677.address}`)
  fs.writeFileSync(
    deployResultsPath,
    JSON.stringify(
      {
        homeBridge: {
          ...homeBridge
        },
        foreignBridge: {
          ...foreignBridge,
          erc677
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function deployErcToErc() {
  const deployHome = require('./src/erc_to_erc/home')
  const deployForeign = require('./src/erc_to_erc/foreign')

  const { homeBridge, erc677 } = await deployHome()
  const { foreignBridge } = await deployForeign()
  console.log('\nDeployment has been completed.\n\n')
  console.log(
    `[   Home  ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`
  )
  console.log(`[   Home  ] ERC677 Bridgeable Token: ${erc677.address}`)
  console.log(
    `[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${
      foreignBridge.deployedBlockNumber
    }`
  )
  console.log(`[ Foreign ] ERC20 Token: ${ERC20_TOKEN_ADDRESS}`)
  fs.writeFileSync(
    deployResultsPath,
    JSON.stringify(
      {
        homeBridge: {
          ...homeBridge,
          erc677
        },
        foreignBridge: {
          ...foreignBridge
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
}

async function deployErcToNative() {
  const deployHome = require('./src/erc_to_native/home')
  const deployForeign = require('./src/erc_to_native/foreign')

  const { homeBridge } = await deployHome()
  const { foreignBridge } = await deployForeign()
  console.log('\nDeployment has been completed.\n\n')
  console.log(
    `[ Home ] HomeBridge: ${homeBridge.address} at block ${homeBridge.deployedBlockNumber}`
  )
  console.log(
    `[ Foreign ] ForeignBridge: ${foreignBridge.address} at block ${
      foreignBridge.deployedBlockNumber
    }`
  )
  fs.writeFileSync(
    deployResultsPath,
    JSON.stringify(
      {
        homeBridge: {
          ...homeBridge
        },
        foreignBridge: {
          ...foreignBridge
        }
      },
      null,
      4
    )
  )
  console.log('Contracts Deployment have been saved to `bridgeDeploymentResults.json`')
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
    default:
      console.log(BRIDGE_MODE)
      throw new Error('Please specify BRIDGE_MODE: NATIVE_TO_ERC or ERC_TO_ERC')
  }
}

main().catch(e => console.log('Error:', e))

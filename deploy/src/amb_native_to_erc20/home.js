const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY, HOME_REWARDABLE } = require('../loadEnv')

const {
  homeContracts: { EternalStorageProxy, HomeAMBNativeToErc20: HomeBridge, HomeFeeManagerAMBNativeToErc20 }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const isRewardableBridge = HOME_REWARDABLE === 'ONE_DIRECTION'

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  let feeManagerAddress

  console.log('\n[Home] Deploying Bridge Mediator storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Storage: ', homeBridgeStorage.options.address)

  console.log('\n[Home] Deploying Bridge Mediator implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Implementation: ', homeBridgeImplementation.options.address)

  console.log('\n[Home] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  if (isRewardableBridge) {
    console.log('\n[Home] Deploying Fee Manager')
    const feeManager = await deployContract(HomeFeeManagerAMBNativeToErc20, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce
    })
    feeManagerAddress = feeManager.options.address
    console.log('[Home] feeManager Implementation: ', feeManagerAddress)
    nonce++
  }

  console.log('\nHome part of Native-to-ERC20 bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    homeFeeManager: { address: feeManagerAddress }
  }
}

module.exports = deployHome

const Web3Utils = require('web3-utils')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_REWARDABLE,
  HOME_MEDIATOR_REWARD_ACCOUNTS,
  HOME_BRIDGE_OWNER,
  FOREIGN_TRANSACTIONS_FEE
} = require('../loadEnv')
const { ZERO_ADDRESS } = require('../constants')

const {
  homeContracts: { EternalStorageProxy, HomeAMBNativeToErc20: HomeBridge, HomeFeeManagerAMBNativeToErc20 }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const isRewardableBridge = HOME_REWARDABLE === 'ONE_DIRECTION'

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  let feeManagerAddress = ZERO_ADDRESS

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
    const feeInWei = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')
    const rewardList = HOME_MEDIATOR_REWARD_ACCOUNTS.split(' ')

    console.log('\n[Home] Deploying Fee Manager')
    console.log(`
    OWNER: ${HOME_BRIDGE_OWNER},
    Fee: ${feeInWei} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%
    Mediator: ${homeBridgeStorage.options.address}
  `)
    rewardList.forEach((account, index) => {
      console.log(`${index + 1}: ${account}`)
    })
    const feeManagerImpl = await deployContract(
      HomeFeeManagerAMBNativeToErc20,
      [HOME_BRIDGE_OWNER, feeInWei, rewardList, homeBridgeStorage.options.address],
      {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        nonce
      }
    )
    console.log('[Home] Fee Manager: ', feeManagerImpl.options.address)
    feeManagerAddress = feeManagerImpl.options.address
    nonce++
  }

  console.log('\nHome part of Native-to-ERC20 bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    homeFeeManager: { address: feeManagerAddress }
  }
}

module.exports = deployHome

const Web3Utils = require('web3-utils')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  BLOCK_REWARD_ADDRESS,
  HOME_BRIDGE_OWNER,
  HOME_REWARDABLE,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TRANSACTIONS_FEE,
  HOME_MEDIATOR_REWARD_ACCOUNTS
} = require('../loadEnv')

const {
  homeContracts: { EternalStorageProxy, HomeAMBErc20ToNative: HomeBridge, HomeFeeManagerAMBErc20ToNative }
} = require('../loadContracts')
const { ZERO_ADDRESS } = require('../constants')

const isRewardableBridge = HOME_REWARDABLE === 'BOTH_DIRECTIONS'

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let feeManagerAddress = ZERO_ADDRESS
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

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

  if (isRewardableBridge) {
    const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
    const foreignFeeInWei = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')
    const rewardList = HOME_MEDIATOR_REWARD_ACCOUNTS.split(' ')

    console.log('\n[Home] Deploying Fee Manager')
    console.log(`
    OWNER: ${HOME_BRIDGE_OWNER},
    Home to Foreign fee: ${homeFeeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%
    Foreign to Home fee: ${foreignFeeInWei} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%
    Mediator: ${homeBridgeStorage.options.address}
    BlockReward: ${BLOCK_REWARD_ADDRESS}
    `)
    console.log('Reward addresses:')
    rewardList.forEach((account, index) => {
      console.log(`${index + 1}: ${account}`)
    })
    const feeManagerImpl = await deployContract(
      HomeFeeManagerAMBErc20ToNative,
      [HOME_BRIDGE_OWNER, homeFeeInWei, foreignFeeInWei, rewardList, homeBridgeStorage.options.address, BLOCK_REWARD_ADDRESS],
      {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        nonce
      }
    )
    console.log('[Home] Fee Manager: ', feeManagerImpl.options.address)
    feeManagerAddress = feeManagerImpl.options.address
    nonce++
  }

  console.log('\n[Home] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })

  console.log('\nHome part of ERC20-To-Native bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    homeFeeManager: { address: feeManagerAddress }
  }
}

module.exports = deployHome

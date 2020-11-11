const assert = require('assert')
const Web3Utils = require('web3-utils')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  HOME_BRIDGE_OWNER,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_ERC677_TOKEN_IMAGE,
  HOME_TOKEN_FACTORY,
  HOME_FORWARDING_RULES_MANAGER,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  HOME_REWARDABLE,
  HOME_MEDIATOR_REWARD_ACCOUNTS,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TRANSACTIONS_FEE
} = require('../loadEnv')
const { ZERO_ADDRESS } = require('../constants')

const {
  homeContracts: {
    EternalStorageProxy,
    HomeMultiAMBErc20ToErc677: HomeBridge,
    ERC677BridgeTokenPermittable,
    TokenFactory,
    MultiTokenForwardingRulesManager,
    MultiTokenBridgeLimitsManager,
    MultiTokenFeeManager
  }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
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

  console.log('\n[Home] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  let tokenFactory = HOME_TOKEN_FACTORY
  if (!tokenFactory) {
    let homeTokenImage = HOME_ERC677_TOKEN_IMAGE
    if (!homeTokenImage) {
      console.log('\n[Home] Deploying new ERC677 token image')
      const chainId = await web3Home.eth.getChainId()
      assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
      const erc677token = await deployContract(ERC677BridgeTokenPermittable, ['', '', 0, chainId], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        nonce: nonce++
      })
      homeTokenImage = erc677token.options.address
      console.log('\n[Home] New ERC677 token image has been deployed: ', homeTokenImage)
    } else {
      console.log('\n[Home] Using existing ERC677 token image: ', homeTokenImage)
    }
    console.log('\n[Home] Deploying new token factory')
    const factory = await deployContract(TokenFactory, [HOME_BRIDGE_OWNER, homeTokenImage], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce: nonce++
    })
    tokenFactory = factory.options.address
    console.log('\n[Home] New token factory has been deployed: ', tokenFactory)
  } else {
    console.log('\n[Home] Using existing token factory: ', tokenFactory)
  }

  let forwardingRulesManager = HOME_FORWARDING_RULES_MANAGER
  if (!forwardingRulesManager) {
    console.log('\n[Home] Deploying new forwarding rules manager')
    const manager = await deployContract(MultiTokenForwardingRulesManager, [HOME_BRIDGE_OWNER], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce: nonce++
    })
    forwardingRulesManager = manager.options.address
    console.log('\n[Home] New forwarding rules manager has been deployed: ', forwardingRulesManager)
  } else {
    console.log('\n[Home] Using existing forwarding rules manager: ', forwardingRulesManager)
  }

  console.log('\n[Home] Deploying new limits manager')
  const limitsManager = (await deployContract(
    MultiTokenBridgeLimitsManager,
    [
      homeBridgeStorage.options.address,
      HOME_BRIDGE_OWNER,
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString(), HOME_MIN_AMOUNT_PER_TX.toString()],
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString()]
    ],
    {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce: nonce++
    }
  )).options.address
  console.log('\n[Home] New limits manager has been deployed: ', limitsManager)

  let feeManager = ZERO_ADDRESS
  if (HOME_REWARDABLE === 'BOTH_DIRECTIONS') {
    const rewardAddressList = HOME_MEDIATOR_REWARD_ACCOUNTS.split(' ')
    const homeToForeignFee = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
    const foreignToHomeFee = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')
    console.log('\n[Home] Deploying new fee manager with the following fee parameters:')
    console.log(`
    REWARD_ADDRESS_LIST: [${rewardAddressList.join(', ')}]
    HOME_TO_FOREIGN_FEE: ${homeToForeignFee} which is ${HOME_TRANSACTIONS_FEE * 100}%
    FOREIGN_TO_HOME_FEE: ${foreignToHomeFee} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%
    `)
    feeManager = (await deployContract(
      MultiTokenFeeManager,
      [
        homeBridgeStorage.options.address,
        HOME_BRIDGE_OWNER,
        rewardAddressList,
        [homeToForeignFee.toString(), foreignToHomeFee.toString()]
      ],
      {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        nonce: nonce++
      }
    )).options.address
    console.log('\n[Home] New fee manager has been deployed: ', feeManager)
  }

  console.log('\nHome part of MULTI_AMB_ERC20_TO_ERC677 bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    tokenFactory: { address: tokenFactory },
    limitsManager: { address: limitsManager },
    feeManager: { address: feeManager },
    forwardingRulesManager: { address: forwardingRulesManager }
  }
}

module.exports = deployHome

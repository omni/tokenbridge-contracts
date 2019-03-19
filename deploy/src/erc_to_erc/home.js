const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxHome,
  upgradeProxy,
  initializeValidators,
  transferProxyOwnership,
  setBridgeContract,
  transferOwnership,
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const HomeBridge = require('../../../build/contracts/HomeBridgeErcToErc.json')
const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_BRIDGE_OWNER,
  HOME_VALIDATORS_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS,
  HOME_GAS_PRICE,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeBridge({ validatorsBridge, bridge, erc677token, initialNonce }) {
  let nonce = initialNonce

  console.log(`Home Validators: ${validatorsBridge.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    HOME_MAX_AMOUNT_PER_TX
  )} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    HOME_MIN_AMOUNT_PER_TX
  )} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS}
  `)
  const initializeHomeBridgeData = await bridge.methods
    .initialize(
      validatorsBridge.options.address,
      HOME_DAILY_LIMIT,
      HOME_MAX_AMOUNT_PER_TX,
      HOME_MIN_AMOUNT_PER_TX,
      HOME_GAS_PRICE,
      HOME_REQUIRED_BLOCK_CONFIRMATIONS,
      erc677token.options.address,
      FOREIGN_DAILY_LIMIT,
      FOREIGN_MAX_AMOUNT_PER_TX,
      HOME_BRIDGE_OWNER
    )
    .encodeABI()
  const txInitializeHomeBridge = await sendRawTxHome({
    data: initializeHomeBridgeData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  if (txInitializeHomeBridge.status) {
    assert.strictEqual(
      Web3Utils.hexToNumber(txInitializeHomeBridge.status),
      1,
      'Transaction Failed'
    )
  } else {
    await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  nonce++

  return nonce
}

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)
  nonce++

  console.log('\ndeploying implementation for home validators')
  const bridgeValidatorsHome = await deployContract(BridgeValidators, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  console.log('[Home] BridgeValidators Implementation: ', bridgeValidatorsHome.options.address)
  nonce++

  console.log('\nhooking up eternal storage to BridgeValidators')
  await upgradeProxy({
    proxy: storageValidatorsHome,
    implementationAddress: bridgeValidatorsHome.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\ninitializing Home Bridge Validators with following parameters:\n')
  await initializeValidators({
    contract: bridgeValidatorsHome,
    isRewardableBridge: false,
    requiredNumber: REQUIRED_NUMBER_OF_VALIDATORS,
    validators: VALIDATORS,
    rewardAccounts: [],
    owner: HOME_VALIDATORS_OWNER,
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('transferring proxy ownership to multisig for Validators Proxy contract')
  await transferProxyOwnership({
    proxy: storageValidatorsHome,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\n[Home] deploying Bridgeble token')
  const erc677token = await deployContract(
    ERC677BridgeToken,
    [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'home', nonce }
  )
  nonce++
  console.log('[Home] Bridgeble Token: ', erc677token.options.address)

  console.log('\nset bridge contract on ERC677BridgeToken')
  await setBridgeContract({
    contract: erc677token,
    bridgeAddress: homeBridgeStorage.options.address,
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('transferring ownership of Bridgeble token to homeBridge contract')
  await transferOwnership({
    contract: erc677token,
    newOwner: homeBridgeStorage.options.address,
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\ninitializing Home Bridge with following parameters:\n')
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address

  nonce = await initializeBridge({
    validatorsBridge: storageValidatorsHome,
    bridge: homeBridgeImplementation,
    erc677token,
    initialNonce: nonce
  })

  console.log('transferring proxy ownership to multisig for Home bridge Proxy contract')
  await transferProxyOwnership({
    proxy: homeBridgeStorage,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })

  console.log('\nHome Deployment Bridge completed\n')
  return {
    homeBridge: {
      address: homeBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
    },
    erc677: { address: erc677token.options.address }
  }
}
module.exports = deployHome

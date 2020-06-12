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
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Home, web3Foreign, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const {
  homeContracts: { EternalStorageProxy, BridgeValidators, HomeAMB: HomeBridge }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_GAS_PRICE,
  HOME_BRIDGE_OWNER,
  HOME_VALIDATORS_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeBridge({ validatorsBridge, bridge, initialNonce }) {
  let nonce = initialNonce

  const homeChainId = await web3Home.eth.getChainId()
  const foreignChainId = await web3Foreign.eth.getChainId()

  console.log('\ninitializing Home Bridge with following parameters:\n')
  console.log(`SOURCE_CHAIN_ID: ${homeChainId}, DESTINATION_CHAIN_ID: ${foreignChainId}, Home Validators: ${validatorsBridge.options.address},
  HOME_MAX_AMOUNT_PER_TX (gas limit per call): ${HOME_MAX_AMOUNT_PER_TX},
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS}
  `)
  const initializeHomeBridgeData = await bridge.methods
    .initialize(
      homeChainId,
      foreignChainId,
      validatorsBridge.options.address,
      HOME_MAX_AMOUNT_PER_TX,
      HOME_GAS_PRICE,
      HOME_REQUIRED_BLOCK_CONFIRMATIONS,
      HOME_BRIDGE_OWNER
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeHomeBridge = await sendRawTxHome({
    data: initializeHomeBridgeData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  if (txInitializeHomeBridge.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeHomeBridge.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  nonce++

  return nonce
}

async function deployHome() {
  console.log('========================================')
  console.log('Deploying Arbitrary Message Bridge at Home')
  console.log('========================================\n')

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
  bridgeValidatorsHome.options.address = storageValidatorsHome.options.address
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

  console.log('\ndeploying HomeAMBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeAMBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying HomeAMBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeAMBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeAMBridge storage to HomeAMBridge implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  nonce = await initializeBridge({
    validatorsBridge: storageValidatorsHome,
    bridge: homeBridgeImplementation,
    initialNonce: nonce
  })

  console.log('transferring proxy ownership to multisig for Home bridge Proxy contract')
  await transferProxyOwnership({
    proxy: homeBridgeStorage,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })

  console.log('\nDeployment of Arbitrary Message Bridge at Home completed\n')
  return {
    homeBridge: {
      address: homeBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
    }
  }
}
module.exports = deployHome

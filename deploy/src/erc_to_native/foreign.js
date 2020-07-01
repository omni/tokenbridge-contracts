const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxForeign,
  upgradeProxy,
  initializeValidators,
  transferProxyOwnership,
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')
const {
  foreignContracts: { EternalStorageProxy, BridgeValidators, ForeignBridgeErcToNative: ForeignBridge }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  FOREIGN_GAS_PRICE,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_VALIDATORS_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  ERC20_TOKEN_ADDRESS,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  FOREIGN_TO_HOME_DECIMAL_SHIFT
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0

async function initializeBridge({ validatorsBridge, bridge, nonce, homeBridgeAddress }) {
  console.log(`Foreign Validators: ${validatorsBridge.options.address},
  ERC20_TOKEN_ADDRESS: ${ERC20_TOKEN_ADDRESS},
  FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    FOREIGN_MAX_AMOUNT_PER_TX
  )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    FOREIGN_MIN_AMOUNT_PER_TX
  )} in eth,
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
  HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER},
  FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
  Home bridge Address: ${homeBridgeAddress}
  `)
  const initializeFBridgeData = await bridge.methods
    .initialize(
      validatorsBridge.options.address,
      ERC20_TOKEN_ADDRESS,
      FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
      FOREIGN_GAS_PRICE,
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString(), FOREIGN_MIN_AMOUNT_PER_TX.toString()],
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString()],
      FOREIGN_BRIDGE_OWNER,
      foreignToHomeDecimalShift,
      homeBridgeAddress
    )
    .encodeABI()
  const txInitializeBridge = await sendRawTxForeign({
    data: initializeFBridgeData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  if (txInitializeBridge.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeBridge.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
}

async function deployForeign(homeBridgeAddress) {
  if (!Web3Utils.isAddress(ERC20_TOKEN_ADDRESS)) {
    throw new Error('ERC20_TOKEN_ADDRESS env var is not defined')
  }
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsForeign = await deployContract(BridgeValidators, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] BridgeValidators Implementation: ', bridgeValidatorsForeign.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  await upgradeProxy({
    proxy: storageValidatorsForeign,
    implementationAddress: bridgeValidatorsForeign.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ninitializing Foreign Bridge Validators with following parameters:\n')
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  await initializeValidators({
    contract: bridgeValidatorsForeign,
    isRewardableBridge: false,
    requiredNumber: REQUIRED_NUMBER_OF_VALIDATORS,
    validators: VALIDATORS,
    rewardAccounts: [],
    owner: FOREIGN_VALIDATORS_OWNER,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\nTransferring ownership of ValidatorsProxy\n')
  await transferProxyOwnership({
    proxy: storageValidatorsForeign,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  await upgradeProxy({
    proxy: foreignBridgeStorage,
    implementationAddress: foreignBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ninitializing Foreign Bridge with following parameters:\n')
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  await initializeBridge({
    validatorsBridge: storageValidatorsForeign,
    bridge: foreignBridgeImplementation,
    nonce,
    homeBridgeAddress
  })
  nonce++

  console.log('transferring proxy ownership to multisig for foreign bridge Proxy contract')
  await transferProxyOwnership({
    proxy: foreignBridgeStorage,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })

  console.log('\nForeign Deployment Bridge completed\n')
  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(foreignBridgeStorage.deployedBlockNumber)
    }
  }
}

module.exports = deployForeign

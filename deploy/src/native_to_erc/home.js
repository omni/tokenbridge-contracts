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
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')
const {
  homeContracts: {
    EternalStorageProxy,
    BridgeValidators,
    RewardableValidators,
    FeeManagerNativeToErc,
    HomeBridgeNativeToErc,
    FeeManagerNativeToErcBothDirections,
    AbsoluteDailyLimit,
    RelativeExecutionDailyLimit
  }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_GAS_PRICE,
  HOME_BRIDGE_OWNER,
  HOME_VALIDATORS_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  HOME_REWARDABLE,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TRANSACTIONS_FEE,
  FOREIGN_TO_HOME_DECIMAL_SHIFT,
  RELATIVE_DAILY_LIMIT,
  TARGET_LIMIT,
  THRESHOLD,
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0

const isBothDirectionsFeeManager = HOME_REWARDABLE === 'BOTH_DIRECTIONS'
const isRewardableBridge = HOME_REWARDABLE === 'ONE_DIRECTION' || isBothDirectionsFeeManager

let VALIDATORS_REWARD_ACCOUNTS = []

if (isRewardableBridge) {
  VALIDATORS_REWARD_ACCOUNTS = env.VALIDATORS_REWARD_ACCOUNTS.split(' ')
}

async function initializeBridge({ validatorsBridge, bridge, limitsContract, initialNonce }) {
  let nonce = initialNonce
  let initializeHomeBridgeData

  const executionLimitsArray = RELATIVE_DAILY_LIMIT
    ? [TARGET_LIMIT, THRESHOLD, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX]
    : [FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX]

  let RELATIVE_DAILY_LIMIT_PARAMS
  if (RELATIVE_DAILY_LIMIT) {
    RELATIVE_DAILY_LIMIT_PARAMS = `TARGET_LIMIT: ${TARGET_LIMIT} which is ${
      Web3Utils.fromWei(Web3Utils.toBN(TARGET_LIMIT).mul(Web3Utils.toBN(100)))
    }%,
    THRESHOLD: ${THRESHOLD} which is ${Web3Utils.fromWei(THRESHOLD)} in eth,`
  }

  if (isRewardableBridge) {
    console.log('\ndeploying implementation for fee manager')
    const feeManagerContract = isBothDirectionsFeeManager ? FeeManagerNativeToErcBothDirections : FeeManagerNativeToErc
    const feeManager = await deployContract(feeManagerContract, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce
    })
    console.log('[Home] feeManager Implementation: ', feeManager.options.address)
    nonce++

    const homeFee = isBothDirectionsFeeManager ? HOME_TRANSACTIONS_FEE.toString() : '0'
    const homeFeeInWei = Web3Utils.toWei(homeFee, 'ether')
    const foreignFeeInWei = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')

    console.log('\ninitializing Home Bridge with fee contract:\n')
    console.log(`Home Validators: ${validatorsBridge.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MIN_AMOUNT_PER_TX)} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS},
  ${
    RELATIVE_DAILY_LIMIT
      ? RELATIVE_DAILY_LIMIT_PARAMS
      : `FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,`
  }
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  HOME_BRIDGE_OWNER: ${HOME_BRIDGE_OWNER},
  Fee Manager: ${feeManager.options.address},
  Home Fee: ${homeFeeInWei} which is ${homeFee * 100}%
  Foreign Fee: ${foreignFeeInWei} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%,
  FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
  LIMITS_CONTRACT: ${limitsContract.options.address}`)

    initializeHomeBridgeData = await bridge.methods
      .rewardableInitialize(
        validatorsBridge.options.address,
        [HOME_DAILY_LIMIT, HOME_MAX_AMOUNT_PER_TX, HOME_MIN_AMOUNT_PER_TX],
        HOME_GAS_PRICE,
        HOME_REQUIRED_BLOCK_CONFIRMATIONS,
        executionLimitsArray,
        HOME_BRIDGE_OWNER,
        feeManager.options.address,
        [homeFeeInWei, foreignFeeInWei],
        foreignToHomeDecimalShift,
        limitsContract.options.address
      )
      .encodeABI()
  } else {
    console.log('\ninitializing Home Bridge with following parameters:\n')
    console.log(`Home Validators: ${validatorsBridge.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MIN_AMOUNT_PER_TX)} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS},
  ${
    RELATIVE_DAILY_LIMIT
      ? RELATIVE_DAILY_LIMIT_PARAMS
      : `FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,`
  }
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  HOME_BRIDGE_OWNER: ${HOME_BRIDGE_OWNER},
  FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
  LIMITS_CONTRACT: ${limitsContract.options.address}
  `)
    initializeHomeBridgeData = await bridge.methods
      .initialize(
        validatorsBridge.options.address,
        [HOME_DAILY_LIMIT, HOME_MAX_AMOUNT_PER_TX, HOME_MIN_AMOUNT_PER_TX],
        HOME_GAS_PRICE,
        HOME_REQUIRED_BLOCK_CONFIRMATIONS,
        executionLimitsArray,
        HOME_BRIDGE_OWNER,
        foreignToHomeDecimalShift,
        limitsContract.options.address
      )
      .encodeABI()
  }

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
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)
  nonce++

  console.log('\ndeploying implementation for home validators')
  const bridgeValidatorsContract = isRewardableBridge ? RewardableValidators : BridgeValidators
  const bridgeValidatorsHome = await deployContract(bridgeValidatorsContract, [], {
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
    isRewardableBridge,
    requiredNumber: REQUIRED_NUMBER_OF_VALIDATORS,
    validators: VALIDATORS,
    rewardAccounts: VALIDATORS_REWARD_ACCOUNTS,
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

  console.log('\ndeploying limits contract')
  const LimitsContract = RELATIVE_DAILY_LIMIT ? RelativeExecutionDailyLimit : AbsoluteDailyLimit
  const limitsContract = await deployContract(LimitsContract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Limits Contract: ', limitsContract.options.address)

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridgeNativeToErc, [], {
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

  homeBridgeImplementation.options.address = homeBridgeStorage.options.address
  nonce = await initializeBridge({
    validatorsBridge: storageValidatorsHome,
    bridge: homeBridgeImplementation,
    limitsContract,
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
    }
  }
}
module.exports = deployHome

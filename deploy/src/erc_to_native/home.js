const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxHome,
  logValidatorsAndRewardAccounts
} = require('../deploymentUtils')
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const RewardableValidators = require('../../../build/contracts/RewardableValidators.json')
const FeeManagerErcToNative = require('../../../build/contracts/FeeManagerErcToNative.json')
const HomeBridge = require('../../../build/contracts/HomeBridgeErcToNative.json')

const VALIDATORS = env.VALIDATORS.split(' ')
const VALIDATORS_REWARD_ACCOUNTS = env.VALIDATORS_REWARD_ACCOUNTS.split(' ')

const {
  BLOCK_REWARD_ADDRESS,
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
  HOME_REWARDABLE,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TRANSACTIONS_FEE
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const isRewardableBridge = HOME_REWARDABLE === 'true'

async function deployHome() {
  let homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('deploying storage for home validators')
  const storageValidatorsHome = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  console.log('[Home] BridgeValidators Storage: ', storageValidatorsHome.options.address)
  homeNonce++

  console.log('\ndeploying implementation for home validators')
  const bridgeValidatorsContract = isRewardableBridge ? RewardableValidators : BridgeValidators
  const bridgeValidatorsHome = await deployContract(bridgeValidatorsContract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  console.log('[Home] BridgeValidators Implementation: ', bridgeValidatorsHome.options.address)
  homeNonce++

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVHomeData = await storageValidatorsHome.methods
    .upgradeTo('1', bridgeValidatorsHome.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToBridgeVHome = await sendRawTxHome({
    data: upgradeToBridgeVHomeData,
    nonce: homeNonce,
    to: storageValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txUpgradeToBridgeVHome.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\ninitializing Home Bridge Validators with following parameters:\n')
  bridgeValidatorsHome.options.address = storageValidatorsHome.options.address

  let initializeData

  if (isRewardableBridge) {
    console.log(
      `REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, HOME_VALIDATORS_OWNER: ${HOME_VALIDATORS_OWNER}`
    )
    logValidatorsAndRewardAccounts(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
    initializeData = await bridgeValidatorsHome.methods
      .initialize(
        REQUIRED_NUMBER_OF_VALIDATORS,
        VALIDATORS,
        VALIDATORS_REWARD_ACCOUNTS,
        HOME_VALIDATORS_OWNER
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  } else {
    console.log(
      `REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}`
    )
    initializeData = await bridgeValidatorsHome.methods
      .initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, HOME_VALIDATORS_OWNER)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  }

  const txInitialize = await sendRawTxHome({
    data: initializeData,
    nonce: homeNonce,
    to: bridgeValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('transferring proxy ownership to multisig for Validators Proxy contract')
  const proxyDataTransfer = await storageValidatorsHome.methods
    .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
    .encodeABI()
  const txProxyDataTransfer = await sendRawTxHome({
    data: proxyDataTransfer,
    nonce: homeNonce,
    to: storageValidatorsHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txProxyDataTransfer.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\ndeploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\ndeploying homeBridge implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\nhooking up HomeBridge storage to HomeBridge implementation')
  const upgradeToHomeBridgeData = await homeBridgeStorage.methods
    .upgradeTo('1', homeBridgeImplementation.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToHomeBridge = await sendRawTxHome({
    data: upgradeToHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txUpgradeToHomeBridge.status), 1, 'Transaction Failed')
  homeNonce++

  let initializeHomeBridgeData
  homeBridgeImplementation.options.address = homeBridgeStorage.options.address

  if (isRewardableBridge) {
    console.log('\ndeploying implementation for fee manager')
    const feeManager = await deployContract(FeeManagerErcToNative, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce: homeNonce
    })
    console.log('[Home] feeManager Implementation: ', feeManager.options.address)
    homeNonce++

    const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
    const foreignFeeInWei = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')
    console.log('\ninitializing Home Bridge with fee contract:\n')
    console.log(`Home Validators: ${storageValidatorsHome.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MAX_AMOUNT_PER_TX
    )} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MIN_AMOUNT_PER_TX
    )} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS},
  BLOCK_REWARD_ADDRESS: ${BLOCK_REWARD_ADDRESS},
  FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(
      FOREIGN_DAILY_LIMIT
    )} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  HOME_BRIDGE_OWNER: ${HOME_BRIDGE_OWNER},
  Fee Manager: ${feeManager.options.address},
  Home Fee: ${homeFeeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%
  Foreign Fee: ${homeFeeInWei} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%`)
    initializeHomeBridgeData = await homeBridgeImplementation.methods
      .rewardableInitialize(
        storageValidatorsHome.options.address,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        HOME_MIN_AMOUNT_PER_TX,
        HOME_GAS_PRICE,
        HOME_REQUIRED_BLOCK_CONFIRMATIONS,
        BLOCK_REWARD_ADDRESS,
        FOREIGN_DAILY_LIMIT,
        FOREIGN_MAX_AMOUNT_PER_TX,
        HOME_BRIDGE_OWNER,
        feeManager.options.address,
        homeFeeInWei,
        foreignFeeInWei
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  } else {
    console.log('\ninitializing Home Bridge with following parameters:\n')
    console.log(`Home Validators: ${storageValidatorsHome.options.address},
  HOME_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MAX_AMOUNT_PER_TX
    )} in eth,
  HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MIN_AMOUNT_PER_TX
    )} in eth,
  HOME_GAS_PRICE: ${HOME_GAS_PRICE}, HOME_REQUIRED_BLOCK_CONFIRMATIONS : ${HOME_REQUIRED_BLOCK_CONFIRMATIONS},
  BLOCK_REWARD_ADDRESS: ${BLOCK_REWARD_ADDRESS},
  FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(
      FOREIGN_DAILY_LIMIT
    )} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  HOME_BRIDGE_OWNER: ${HOME_BRIDGE_OWNER}
  `)
    initializeHomeBridgeData = await homeBridgeImplementation.methods
      .initialize(
        storageValidatorsHome.options.address,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        HOME_MIN_AMOUNT_PER_TX,
        HOME_GAS_PRICE,
        HOME_REQUIRED_BLOCK_CONFIRMATIONS,
        BLOCK_REWARD_ADDRESS,
        FOREIGN_DAILY_LIMIT,
        FOREIGN_MAX_AMOUNT_PER_TX,
        HOME_BRIDGE_OWNER
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  }

  const txInitializeHomeBridge = await sendRawTxHome({
    data: initializeHomeBridgeData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeHomeBridge.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('transferring proxy ownership to multisig for Home bridge Proxy contract')
  const homeBridgeProxyData = await homeBridgeStorage.methods
    .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
    .encodeABI()
  const txhomeBridgeProxyData = await sendRawTxHome({
    data: homeBridgeProxyData,
    nonce: homeNonce,
    to: homeBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txhomeBridgeProxyData.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\nHome Deployment Bridge completed\n')
  return {
    homeBridge: {
      address: homeBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
    }
  }
}
module.exports = deployHome

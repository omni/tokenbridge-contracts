const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeAMBNativeToErc20 }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxHome,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  HOME_AMB_BRIDGE,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  HOME_MEDIATOR_REQUEST_GAS_LIMIT,
  HOME_BRIDGE_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_TO_HOME_DECIMAL_SHIFT,
  HOME_REWARDABLE,
  HOME_TRANSACTIONS_FEE,
  HOME_MEDIATOR_REWARD_ACCOUNTS
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initialize({
  contract,
  params: {
    bridgeContract,
    mediatorContract,
    dailyLimit,
    maxPerTx,
    minPerTx,
    executionDailyLimit,
    executionMaxPerTx,
    requestGasLimit,
    foreignToHomeDecimalShift,
    owner
  }
}) {
  console.log(`
    AMB contract: ${bridgeContract},
    Mediator contract: ${mediatorContract},
    DAILY_LIMIT : ${dailyLimit} which is ${Web3Utils.fromWei(dailyLimit)} in eth,
    MAX_AMOUNT_PER_TX: ${maxPerTx} which is ${Web3Utils.fromWei(maxPerTx)} in eth,
    MIN_AMOUNT_PER_TX: ${minPerTx} which is ${Web3Utils.fromWei(minPerTx)} in eth,
    EXECUTION_DAILY_LIMIT : ${executionDailyLimit} which is ${Web3Utils.fromWei(executionDailyLimit)} in eth,
    EXECUTION_MAX_AMOUNT_PER_TX: ${executionMaxPerTx} which is ${Web3Utils.fromWei(executionMaxPerTx)} in eth,
    FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
    MEDIATOR_REQUEST_GAS_LIMIT : ${requestGasLimit},
    OWNER: ${owner}
  `)

  return contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner
    )
    .encodeABI()
}

async function rewardableInitialize({
  contract,
  params: {
    bridgeContract,
    mediatorContract,
    dailyLimit,
    maxPerTx,
    minPerTx,
    executionDailyLimit,
    executionMaxPerTx,
    requestGasLimit,
    foreignToHomeDecimalShift,
    owner,
    feeManager,
    fee,
    rewardList
  }
}) {
  const feeInWei = Web3Utils.toWei(fee.toString(), 'ether')

  console.log(`
    AMB contract: ${bridgeContract},
    Mediator contract: ${mediatorContract},
    DAILY_LIMIT : ${dailyLimit} which is ${Web3Utils.fromWei(dailyLimit)} in eth,
    MAX_AMOUNT_PER_TX: ${maxPerTx} which is ${Web3Utils.fromWei(maxPerTx)} in eth,
    MIN_AMOUNT_PER_TX: ${minPerTx} which is ${Web3Utils.fromWei(minPerTx)} in eth,
    EXECUTION_DAILY_LIMIT : ${executionDailyLimit} which is ${Web3Utils.fromWei(executionDailyLimit)} in eth,
    EXECUTION_MAX_AMOUNT_PER_TX: ${executionMaxPerTx} which is ${Web3Utils.fromWei(executionMaxPerTx)} in eth,
    FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
    MEDIATOR_REQUEST_GAS_LIMIT : ${requestGasLimit},
    OWNER: ${owner},
    Fee Manager: ${feeManager},
    Fee: ${feeInWei} which is ${fee * 100}%
  `)
  rewardList.forEach((account, index) => {
    console.log(`${index + 1}: ${account}`)
  })

  return contract.methods
    .rewardableInitialize(
      bridgeContract,
      mediatorContract,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner,
      feeManager,
      feeInWei,
      rewardList
    )
    .encodeABI()
}

async function initializeMediator({ homeBridge, homeFeeManager, foreignBridge }) {
  const isRewardableBridge = HOME_REWARDABLE === 'ONE_DIRECTION'
  const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  let initializeData
  const contract = new web3Home.eth.Contract(HomeAMBNativeToErc20.abi, homeBridge)

  console.log('\n[Home] Initializing Bridge Mediator with following parameters:')

  if (isRewardableBridge) {
    const rewardList = HOME_MEDIATOR_REWARD_ACCOUNTS.split(' ')

    initializeData = await rewardableInitialize({
      contract,
      params: {
        bridgeContract: HOME_AMB_BRIDGE,
        mediatorContract: foreignBridge,
        dailyLimit: HOME_DAILY_LIMIT,
        maxPerTx: HOME_MAX_AMOUNT_PER_TX,
        minPerTx: HOME_MIN_AMOUNT_PER_TX,
        executionDailyLimit: FOREIGN_DAILY_LIMIT,
        executionMaxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
        requestGasLimit: HOME_MEDIATOR_REQUEST_GAS_LIMIT,
        foreignToHomeDecimalShift,
        owner: HOME_BRIDGE_OWNER,
        feeManager: homeFeeManager,
        fee: HOME_TRANSACTIONS_FEE,
        rewardList
      }
    })
  } else {
    initializeData = await initialize({
      contract,
      params: {
        bridgeContract: HOME_AMB_BRIDGE,
        mediatorContract: foreignBridge,
        dailyLimit: HOME_DAILY_LIMIT,
        maxPerTx: HOME_MAX_AMOUNT_PER_TX,
        minPerTx: HOME_MIN_AMOUNT_PER_TX,
        executionDailyLimit: FOREIGN_DAILY_LIMIT,
        executionMaxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
        requestGasLimit: HOME_MEDIATOR_REQUEST_GAS_LIMIT,
        foreignToHomeDecimalShift,
        owner: HOME_BRIDGE_OWNER
      }
    })
  }

  const txInitialize = await sendRawTxHome({
    data: initializeData,
    nonce,
    to: homeBridge,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })

  if (txInitialize.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('\n[Home] Transferring bridge mediator proxy ownership to upgradeability admin')
  const proxy = new web3Home.eth.Contract(EternalStorageProxy.abi, homeBridge)
  await transferProxyOwnership({
    proxy,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })
}

module.exports = initializeMediator

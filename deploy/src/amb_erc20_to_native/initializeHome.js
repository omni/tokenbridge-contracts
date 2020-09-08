const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeAMBErc20ToNative }
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
  BLOCK_REWARD_ADDRESS,
  HOME_REWARDABLE,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TRANSACTIONS_FEE,
  HOME_MEDIATOR_REWARD_ACCOUNTS
} = require('../loadEnv')

const isRewardableBridge = HOME_REWARDABLE === 'BOTH_DIRECTIONS'

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeMediator({
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
    blockRewardContract
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
    OWNER: ${owner},
    BLOCK_REWARD_ADDRESS: ${blockRewardContract}
  `)

  return contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString(), HOME_MIN_AMOUNT_PER_TX.toString()],
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString()],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner,
      blockRewardContract
    )
    .encodeABI()
}

async function rewardableInitializeMediator({
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
    blockRewardContract,
    rewardAddressList,
    homeToForeignFee,
    foreignToHomeFee
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
    OWNER: ${owner},
    BLOCK_REWARD_ADDRESS: ${blockRewardContract},
    REWARD_ADDRESS_LIST: [${rewardAddressList.join(', ')}],
    HOME_TO_FOREIGN_FEE: ${homeToForeignFee} which is ${HOME_TRANSACTIONS_FEE * 100}%
    FOREIGN_TO_HOME_FEE: ${foreignToHomeFee} which is ${FOREIGN_TRANSACTIONS_FEE * 100}%
  `)

  return contract.methods
    .rewardableInitialize(
      bridgeContract,
      mediatorContract,
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString(), HOME_MIN_AMOUNT_PER_TX.toString()],
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString()],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner,
      blockRewardContract,
      rewardAddressList,
      [homeToForeignFee.toString(), foreignToHomeFee.toString()]
    )
    .encodeABI()
}

async function initialize({ homeBridge, foreignBridge }) {
  const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const mediatorContract = new web3Home.eth.Contract(HomeAMBErc20ToNative.abi, homeBridge)

  console.log('\n[Home] Initializing Bridge Mediator with following parameters:')

  let initializeMediatorData
  if (isRewardableBridge) {
    const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
    const foreignFeeInWei = Web3Utils.toWei(FOREIGN_TRANSACTIONS_FEE.toString(), 'ether')
    const rewardList = HOME_MEDIATOR_REWARD_ACCOUNTS.split(' ')

    initializeMediatorData = await rewardableInitializeMediator({
      contract: mediatorContract,
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
        blockRewardContract: BLOCK_REWARD_ADDRESS,
        rewardAddressList: rewardList,
        homeToForeignFee: homeFeeInWei,
        foreignToHomeFee: foreignFeeInWei
      }
    })
  } else {
    initializeMediatorData = await initializeMediator({
      contract: mediatorContract,
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
        blockRewardContract: BLOCK_REWARD_ADDRESS
      }
    })
  }

  const txInitializeMediator = await sendRawTxHome({
    data: initializeMediatorData,
    nonce,
    to: homeBridge,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })

  if (txInitializeMediator.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeMediator.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(mediatorContract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('\n[Home] Transferring bridge mediator proxy ownership to upgradeability admin')
  const mediatorProxy = new web3Home.eth.Contract(EternalStorageProxy.abi, homeBridge)
  await transferProxyOwnership({
    proxy: mediatorProxy,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })
}

module.exports = initialize

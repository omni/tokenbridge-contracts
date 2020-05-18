const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, web3Foreign, FOREIGN_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  foreignContracts: { EternalStorageProxy, ForeignAMBNativeToErc20 }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxForeign,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_AMB_BRIDGE,
  FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_TO_HOME_DECIMAL_SHIFT
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeMediator({
  contract,
  params: {
    bridgeContract,
    mediatorContract,
    erc677token,
    dailyLimit,
    maxPerTx,
    minPerTx,
    executionDailyLimit,
    executionMaxPerTx,
    requestGasLimit,
    foreignToHomeDecimalShift,
    owner,
    feeManager
  }
}) {
  console.log(`
    AMB contract: ${bridgeContract},
    Mediator contract: ${mediatorContract},
    Token contract: ${erc677token},
    DAILY_LIMIT : ${dailyLimit} which is ${Web3Utils.fromWei(dailyLimit)} in eth,
    MAX_AMOUNT_PER_TX: ${maxPerTx} which is ${Web3Utils.fromWei(maxPerTx)} in eth,
    MIN_AMOUNT_PER_TX: ${minPerTx} which is ${Web3Utils.fromWei(minPerTx)} in eth,
    EXECUTION_DAILY_LIMIT : ${executionDailyLimit} which is ${Web3Utils.fromWei(executionDailyLimit)} in eth,
    EXECUTION_MAX_AMOUNT_PER_TX: ${executionMaxPerTx} which is ${Web3Utils.fromWei(executionMaxPerTx)} in eth,
    FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
    MEDIATOR_REQUEST_GAS_LIMIT : ${requestGasLimit},
    OWNER: ${owner},
    Fee Manager: ${feeManager},
  `)

  return contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner,
      erc677token,
      feeManager
    )
    .encodeABI()
}

async function initialize({ homeBridge, foreignBridge, foreignFeeManager, foreignErc677 }) {
  const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const contract = new web3Home.eth.Contract(ForeignAMBNativeToErc20.abi, foreignBridge)

  console.log('\n[Foreign] Initializing Bridge Mediator with following parameters:')

  const initializeData = await initializeMediator({
    contract,
    params: {
      bridgeContract: FOREIGN_AMB_BRIDGE,
      mediatorContract: homeBridge,
      erc677token: foreignErc677,
      dailyLimit: FOREIGN_DAILY_LIMIT,
      maxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
      minPerTx: FOREIGN_MIN_AMOUNT_PER_TX,
      executionDailyLimit: HOME_DAILY_LIMIT,
      executionMaxPerTx: HOME_MAX_AMOUNT_PER_TX,
      requestGasLimit: FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
      foreignToHomeDecimalShift,
      owner: FOREIGN_BRIDGE_OWNER,
      feeManager: foreignFeeManager
    }
  })

  const txInitialize = await sendRawTxForeign({
    data: initializeData,
    nonce,
    to: foreignBridge,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })

  if (txInitialize.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('\n[Foreign] Transferring bridge mediator proxy ownership to upgradeability admin')
  const proxy = new web3Foreign.eth.Contract(EternalStorageProxy.abi, foreignBridge)
  await transferProxyOwnership({
    proxy,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })
}

module.exports = initialize

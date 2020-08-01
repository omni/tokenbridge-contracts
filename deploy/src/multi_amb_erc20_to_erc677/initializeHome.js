const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeMultiAMBErc20ToErc677: HomeBridge }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxHome,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  HOME_AMB_BRIDGE,
  HOME_MEDIATOR_REQUEST_GAS_LIMIT,
  HOME_BRIDGE_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
} = require('../loadEnv')

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
    owner,
    tokenImage
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
    MEDIATOR_REQUEST_GAS_LIMIT : ${requestGasLimit},
    OWNER: ${owner},
    TOKEN_IMAGE: ${tokenImage}
  `)

  return contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      [dailyLimit.toString(), maxPerTx.toString(), minPerTx.toString()],
      [executionDailyLimit.toString(), executionMaxPerTx.toString()],
      requestGasLimit,
      owner,
      tokenImage
    )
    .encodeABI()
}

async function initialize({ homeBridge, foreignBridge, homeTokenImage }) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const mediatorContract = new web3Home.eth.Contract(HomeBridge.abi, homeBridge)

  console.log('\n[Home] Initializing Bridge Mediator with following parameters:')

  const initializeMediatorData = await initializeMediator({
    contract: mediatorContract,
    params: {
      bridgeContract: HOME_AMB_BRIDGE,
      mediatorContract: foreignBridge,
      requestGasLimit: HOME_MEDIATOR_REQUEST_GAS_LIMIT,
      owner: HOME_BRIDGE_OWNER,
      dailyLimit: HOME_DAILY_LIMIT,
      maxPerTx: HOME_MAX_AMOUNT_PER_TX,
      minPerTx: HOME_MIN_AMOUNT_PER_TX,
      executionDailyLimit: FOREIGN_DAILY_LIMIT,
      executionMaxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
      tokenImage: homeTokenImage
    }
  })

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

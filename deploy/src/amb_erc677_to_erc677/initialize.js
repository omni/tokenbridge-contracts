const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, web3Foreign, FOREIGN_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeAMBErc677ToErc677 },
  foreignContracts: { EternalStorageProxy: ForeignEternalStorageProxy, ForeignAMBErc677ToErc677 }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxHome,
  sendRawTxForeign,
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
  FOREIGN_MIN_AMOUNT_PER_TX,
  HOME_MEDIATOR_REQUEST_GAS_LIMIT,
  HOME_BRIDGE_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_AMB_BRIDGE,
  FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
  ERC20_TOKEN_ADDRESS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_TO_HOME_DECIMAL_SHIFT
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initialize({
  web3,
  url,
  address,
  abi,
  proxyAbi,
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
    owner
  },
  upgradeableAdmin,
  sendRawTx
}) {
  let nonce = await web3.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  const contract = new web3.eth.Contract(abi, address)
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
    OWNER: ${owner}
  `)

  const initializeData = await contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      erc677token,
      [dailyLimit.toString(), maxPerTx.toString(), minPerTx.toString()],
      [executionDailyLimit.toString(), executionMaxPerTx.toString()],
      requestGasLimit,
      foreignToHomeDecimalShift,
      owner
    )
    .encodeABI()
  const txInitialize = await sendRawTx({
    data: initializeData,
    nonce,
    to: address,
    privateKey: deploymentPrivateKey,
    url
  })

  if (txInitialize.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('Transferring bridge mediator proxy ownership to upgradeability admin')
  const proxy = new web3.eth.Contract(proxyAbi, address)
  await transferProxyOwnership({
    proxy,
    newOwner: upgradeableAdmin,
    nonce,
    url
  })
}

async function initializeBridges({ homeBridge, foreignBridge, homeErc677 }) {
  const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0

  console.log('\n[Home] Initializing Bridge Mediator with following parameters:\n')
  await initialize({
    web3: web3Home,
    url: HOME_RPC_URL,
    address: homeBridge,
    abi: HomeAMBErc677ToErc677.abi,
    proxyAbi: EternalStorageProxy.abi,
    params: {
      bridgeContract: HOME_AMB_BRIDGE,
      mediatorContract: foreignBridge,
      erc677token: homeErc677,
      dailyLimit: HOME_DAILY_LIMIT,
      maxPerTx: HOME_MAX_AMOUNT_PER_TX,
      minPerTx: HOME_MIN_AMOUNT_PER_TX,
      executionDailyLimit: FOREIGN_DAILY_LIMIT,
      executionMaxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
      requestGasLimit: HOME_MEDIATOR_REQUEST_GAS_LIMIT,
      foreignToHomeDecimalShift,
      owner: HOME_BRIDGE_OWNER
    },
    upgradeableAdmin: HOME_UPGRADEABLE_ADMIN,
    sendRawTx: sendRawTxHome
  })

  console.log('\n[Foreign] Initializing Bridge Mediator with following parameters:\n')
  await initialize({
    web3: web3Foreign,
    url: FOREIGN_RPC_URL,
    address: foreignBridge,
    abi: ForeignAMBErc677ToErc677.abi,
    proxyAbi: ForeignEternalStorageProxy.abi,
    params: {
      bridgeContract: FOREIGN_AMB_BRIDGE,
      mediatorContract: homeBridge,
      erc677token: ERC20_TOKEN_ADDRESS,
      dailyLimit: FOREIGN_DAILY_LIMIT,
      maxPerTx: FOREIGN_MAX_AMOUNT_PER_TX,
      minPerTx: FOREIGN_MIN_AMOUNT_PER_TX,
      executionDailyLimit: HOME_DAILY_LIMIT,
      executionMaxPerTx: HOME_MAX_AMOUNT_PER_TX,
      requestGasLimit: FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
      foreignToHomeDecimalShift,
      owner: FOREIGN_BRIDGE_OWNER
    },
    upgradeableAdmin: FOREIGN_UPGRADEABLE_ADMIN,
    sendRawTx: sendRawTxForeign
  })
}

module.exports = initializeBridges

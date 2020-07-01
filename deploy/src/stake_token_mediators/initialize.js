const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, web3Foreign, FOREIGN_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeStakeTokenMediator },
  foreignContracts: { EternalStorageProxy: ForeignEternalStorageProxy, ForeignStakeTokenMediator }
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
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_TO_HOME_DECIMAL_SHIFT,
  HOME_STAKE_TOKEN_ADDRESS,
  FOREIGN_STAKE_TOKEN_ADDRESS,
  BLOCK_REWARD_ADDRESS,
  HOME_TRANSACTIONS_FEE
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)
const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0

async function initializeHome(homeMediator, foreignMediator) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  const contract = new web3Home.eth.Contract(HomeStakeTokenMediator.abi, homeMediator)
  const proxy = new web3Home.eth.Contract(EternalStorageProxy.abi, homeMediator)

  const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
  console.log(`
    AMB contract: ${HOME_AMB_BRIDGE}, 
    Mediator contract: ${foreignMediator}, 
    Token contract: ${HOME_STAKE_TOKEN_ADDRESS},
    DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
    MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
    MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MIN_AMOUNT_PER_TX)} in eth,
    EXECUTION_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
    EXECUTION_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
    FOREIGN_MAX_AMOUNT_PER_TX
  )} in eth,
    FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
    MEDIATOR_REQUEST_GAS_LIMIT : ${HOME_MEDIATOR_REQUEST_GAS_LIMIT}, 
    OWNER: ${HOME_BRIDGE_OWNER},
    BLOCK_REWARD_ADDRESS: ${BLOCK_REWARD_ADDRESS},
    Home Fee: ${homeFeeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%
  `)

  const initializeData = await contract.methods
    .rewardableInitialize(
      HOME_AMB_BRIDGE,
      foreignMediator,
      HOME_STAKE_TOKEN_ADDRESS,
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString(), HOME_MIN_AMOUNT_PER_TX.toString()],
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString()],
      HOME_MEDIATOR_REQUEST_GAS_LIMIT,
      foreignToHomeDecimalShift,
      HOME_BRIDGE_OWNER,
      BLOCK_REWARD_ADDRESS,
      homeFeeInWei
    )
    .encodeABI()
  const txInitialize = await sendRawTxHome({
    data: initializeData,
    nonce,
    to: homeMediator,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })

  if (txInitialize.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('Transferring bridge mediator proxy ownership to upgradeability admin')
  await transferProxyOwnership({
    proxy,
    newOwner: HOME_UPGRADEABLE_ADMIN,
    nonce,
    url: HOME_RPC_URL
  })
}

async function initializeForeign(foreignMediator, homeMediator) {
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  const contract = new web3Foreign.eth.Contract(ForeignStakeTokenMediator.abi, foreignMediator)
  const proxy = new web3Foreign.eth.Contract(ForeignEternalStorageProxy.abi, foreignMediator)

  console.log(`
    AMB contract: ${FOREIGN_AMB_BRIDGE}, 
    Mediator contract: ${homeMediator}, 
    Token contract: ${FOREIGN_STAKE_TOKEN_ADDRESS},
    DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
    MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(FOREIGN_MAX_AMOUNT_PER_TX)} in eth,
    MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(FOREIGN_MIN_AMOUNT_PER_TX)} in eth,
    EXECUTION_DAILY_LIMIT : ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
    EXECUTION_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
    FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift},
    MEDIATOR_REQUEST_GAS_LIMIT : ${FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT}, 
    OWNER: ${FOREIGN_BRIDGE_OWNER}
  `)

  const initializeData = await contract.methods
    .initialize(
      FOREIGN_AMB_BRIDGE,
      homeMediator,
      FOREIGN_STAKE_TOKEN_ADDRESS,
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString(), FOREIGN_MIN_AMOUNT_PER_TX.toString()],
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString()],
      FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
      foreignToHomeDecimalShift,
      FOREIGN_BRIDGE_OWNER
    )
    .encodeABI()
  const txInitialize = await sendRawTxForeign({
    data: initializeData,
    nonce,
    to: foreignMediator,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })

  if (txInitialize.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(contract.methods.isInitialized().call, true)
  }
  nonce++

  console.log('Transferring bridge mediator proxy ownership to upgradeability admin')
  await transferProxyOwnership({
    proxy,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })
}

async function initializeBridges({ homeBridge, foreignBridge }) {
  console.log('\n[Home] Initializing Bridge Mediator with following parameters:\n')
  await initializeHome(homeBridge, foreignBridge)

  console.log('\n[Foreign] Initializing Bridge Mediator with following parameters:\n')
  await initializeForeign(foreignBridge, homeBridge)

  console.log(
    `\n[Home] Allow bridge mediator to mint token, by calling transferOwnership(${homeBridge}) and addBridge(${homeBridge}) on token ${HOME_STAKE_TOKEN_ADDRESS}`
  )
  console.log(
    `\n[Foreign] Allow bridge mediator to mint token, by calling addBridge(${foreignBridge}) on token ${FOREIGN_STAKE_TOKEN_ADDRESS}`
  )
}

module.exports = initializeBridges

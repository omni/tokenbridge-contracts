const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, web3Foreign, FOREIGN_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  foreignContracts: { EternalStorageProxy, ForeignAMBENSMirror }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxForeign,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_AMB_BRIDGE,
  FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_ENS_REGISTRY_ADDRESS
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeMediator({
  contract,
  params: {
    bridgeContract,
    mediatorContract,
    requestGasLimit,
    owner,
    ensRegistry
  }
}) {
  console.log(`
    AMB contract: ${bridgeContract},
    Mediator contract: ${mediatorContract},
    MEDIATOR_REQUEST_GAS_LIMIT : ${requestGasLimit},
    OWNER: ${owner},
    ENS_REGISTRY_ADDRESS: ${ensRegistry}
  `)

  return contract.methods
    .initialize(
      bridgeContract,
      mediatorContract,
      requestGasLimit,
      owner,
      ensRegistry
    )
    .encodeABI()
}

async function initialize({ homeBridge, foreignBridge }) {
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const contract = new web3Home.eth.Contract(ForeignAMBENSMirror.abi, foreignBridge)

  console.log('\n[Foreign] Initializing Bridge Mediator with following parameters:')

  const initializeData = await initializeMediator({
    contract,
    params: {
      bridgeContract: FOREIGN_AMB_BRIDGE,
      mediatorContract: homeBridge,
      requestGasLimit: FOREIGN_MEDIATOR_REQUEST_GAS_LIMIT,
      owner: FOREIGN_BRIDGE_OWNER,
      ensRegistry: FOREIGN_ENS_REGISTRY_ADDRESS
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

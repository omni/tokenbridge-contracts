const Web3Utils = require('web3-utils')
const assert = require('assert')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  homeContracts: { EternalStorageProxy, HomeAMBENSMirror }
} = require('../loadContracts')
const {
  privateKeyToAddress,
  sendRawTxHome,
  assertStateWithRetry,
  transferProxyOwnership
} = require('../deploymentUtils')

const {
  HOME_AMB_BRIDGE,
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
    owner,
    resolverContract
  }
}) {
  console.log(`
    AMB contract: ${bridgeContract},
    Mediator contract: ${mediatorContract},
    OWNER: ${owner},
    PUBLIC_RESOLVER: ${resolverContract}
  `)

  return contract.methods.initialize(bridgeContract, mediatorContract, owner, resolverContract).encodeABI()
}

async function initialize({ homeBridge, foreignBridge, publicResolver }) {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const mediatorContract = new web3Home.eth.Contract(HomeAMBENSMirror.abi, homeBridge)

  console.log('\n[Home] Initializing Bridge Mediator with following parameters:')

  const initializeMediatorData = await initializeMediator({
    contract: mediatorContract,
    params: {
      bridgeContract: HOME_AMB_BRIDGE,
      mediatorContract: foreignBridge,
      owner: HOME_BRIDGE_OWNER,
      resolverContract: publicResolver
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

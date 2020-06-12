const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxForeign,
  upgradeProxy,
  initializeValidators,
  transferProxyOwnership,
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Home, web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const {
  foreignContracts: { EternalStorageProxy, BridgeValidators, ForeignAMB: ForeignBridge }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  FOREIGN_GAS_PRICE,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_VALIDATORS_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function initializeBridge({ validatorsBridge, bridge, initialNonce }) {
  let nonce = initialNonce

  const homeChainId = await web3Home.eth.getChainId()
  const foreignChainId = await web3Foreign.eth.getChainId()

  console.log('\ninitializing Foreign Bridge with following parameters:\n')
  console.log(`SOURCE_CHAIN_ID: ${foreignChainId}, DESTINATION_CHAIN_ID: ${homeChainId}, Foreign Validators: ${validatorsBridge.options.address},
  FOREIGN_MAX_AMOUNT_PER_TX (gas limit per call): ${FOREIGN_MAX_AMOUNT_PER_TX},
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS}
  `)
  const initializeFBridgeData = await bridge.methods
    .initialize(
      foreignChainId,
      homeChainId,
      validatorsBridge.options.address,
      FOREIGN_MAX_AMOUNT_PER_TX,
      FOREIGN_GAS_PRICE,
      FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
      FOREIGN_BRIDGE_OWNER
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeBridge = await sendRawTxForeign({
    data: initializeFBridgeData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  if (txInitializeBridge.status) {
    assert.strictEqual(Web3Utils.hexToNumber(txInitializeBridge.status), 1, 'Transaction Failed')
  } else {
    await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  nonce++

  return nonce
}

async function deployForeign() {
  console.log('========================================')
  console.log('Deploying Arbitrary Message Bridge at Foreign')
  console.log('========================================\n')

  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsForeign = await deployContract(BridgeValidators, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] BridgeValidators Implementation: ', bridgeValidatorsForeign.options.address)

  console.log('\nhooking up eternal storage to BridgeValidators')
  await upgradeProxy({
    proxy: storageValidatorsForeign,
    implementationAddress: bridgeValidatorsForeign.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ninitializing Foreign Bridge Validators with following parameters:\n')
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address
  await initializeValidators({
    contract: bridgeValidatorsForeign,
    isRewardableBridge: false,
    requiredNumber: REQUIRED_NUMBER_OF_VALIDATORS,
    validators: VALIDATORS,
    rewardAccounts: [],
    owner: FOREIGN_VALIDATORS_OWNER,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\nTransferring ownership of ValidatorsProxy\n')
  await transferProxyOwnership({
    proxy: storageValidatorsForeign,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ndeploying ForeignAMBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignAMBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying ForeignAMBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignAMBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up ForeignAMBridge storage to ForeignAMBridge implementation')
  await upgradeProxy({
    proxy: foreignBridgeStorage,
    implementationAddress: foreignBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\ninitializing Foreign Bridge with following parameters:\n')
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  nonce = await initializeBridge({
    validatorsBridge: storageValidatorsForeign,
    bridge: foreignBridgeImplementation,
    initialNonce: nonce
  })

  console.log('transferring proxy ownership to multisig for Foreign bridge Proxy contract')
  await transferProxyOwnership({
    proxy: foreignBridgeStorage,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })

  console.log('\nDeployment of Arbitrary Message Bridge at Foreign completed\n')

  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(foreignBridgeStorage.deployedBlockNumber)
    }
  }
}

module.exports = deployForeign

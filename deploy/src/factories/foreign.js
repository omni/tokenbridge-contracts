const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const ForeignBridgeFactory = require('../../../build/contracts/ForeignBridgeFactory.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const ForeignBridge = require('../../../build/contracts/ForeignBridgeErcToErc.json')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  FOREIGN_VALIDATORS_OWNER,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_FACTORY_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  FOREIGN_GAS_PRICE,
  FOREIGN_MAX_AMOUNT_PER_TX,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  DOUBLE_PROXY_IMPLEMENTATIONS
} = env

let {
  FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS,
  FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployForeign() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('========================================')
  console.log('deploying ForeignBridgeFactory')
  console.log('========================================\n')

  if (!FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS) {
    console.log('deploying bridge validators implementation')
    const bridgeValidatorsImplementationForeign = await deployContract(BridgeValidators, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'foreign',
      nonce: foreignNonce
    })
    foreignNonce++
    FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS = bridgeValidatorsImplementationForeign.options.address

    if (DOUBLE_PROXY_IMPLEMENTATIONS) {
      console.log('deploying bridge validators proxy')
      const implProxy = await deployContract(EternalStorageProxy, [], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        network: 'foreign',
        nonce: foreignNonce
      })
      foreignNonce++
      
      console.log('\nhooking up eternal storage to implementation')
      const upgradeToImpl = await implProxy.methods
        .upgradeTo('1', FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txUpgradeToImpl = await sendRawTxForeign({
        data: upgradeToImpl,
        nonce: foreignNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: FOREIGN_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txUpgradeToImpl.status), 1, 'Transaction Failed')
      foreignNonce++
      FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS = implProxy.options.address

      console.log('\nTransferring ownership of Proxy\n')
      const ownershipData = await implProxy.methods
        .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txOwnershipData = await sendRawTxForeign({
        data: ownershipData,
        nonce: foreignNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: FOREIGN_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txOwnershipData.status), 1, 'Transaction Failed')
      foreignNonce++
    }
  }
  console.log('[Foreign] bridge validators implementation address: ', FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS)

  if (!FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS) {
    console.log('deploying foreign bridge implementation')
    const foreignBridgeImplementationForeign = await deployContract(ForeignBridge, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'foreign',
      nonce: foreignNonce
    })
    foreignNonce++
    FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS = foreignBridgeImplementationForeign.options.address

    if (DOUBLE_PROXY_IMPLEMENTATIONS) {
      console.log('deploying foreign bridge proxy')
      const implProxy = await deployContract(EternalStorageProxy, [], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        network: 'foreign',
        nonce: foreignNonce
      })
      foreignNonce++
      
      console.log('\nhooking up eternal storage to implementation')
      const upgradeToImpl = await implProxy.methods
        .upgradeTo('1', FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txUpgradeToImpl = await sendRawTxForeign({
        data: upgradeToImpl,
        nonce: foreignNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: FOREIGN_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txUpgradeToImpl.status), 1, 'Transaction Failed')
      foreignNonce++
      FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS = implProxy.options.address

      console.log('\nTransferring ownership of Proxy\n')
      const ownershipData = await implProxy.methods
        .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txOwnershipData = await sendRawTxForeign({
        data: ownershipData,
        nonce: foreignNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: FOREIGN_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txOwnershipData.status), 1, 'Transaction Failed')
      foreignNonce++
    }
  }
  console.log('[Foreign] foreign bridge implementation address: ', FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS)

  console.log('deploying storage for foreign bridge factory')
  const storageBridgeFactoryForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] BridgeFactory Storage: ', storageBridgeFactoryForeign.options.address)
  
  console.log('\ndeploying implementation for foreign bridge factory')
  const bridgeFactoryForeign = await deployContract(ForeignBridgeFactory, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log(
    '[Foreign] BridgeFactory Implementation: ',
    bridgeFactoryForeign.options.address
  )
  console.log('\nhooking up eternal storage to BridgeFactory')
  const upgradeToForeignFactoryData = await storageBridgeFactoryForeign.methods
    .upgradeTo('1', bridgeFactoryForeign.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToForeignFactory = await sendRawTxForeign({
    data: upgradeToForeignFactoryData,
    nonce: foreignNonce,
    to: storageBridgeFactoryForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txUpgradeToForeignFactory.status), 1, 'Transaction Failed')
  foreignNonce++
  
  console.log('\ninitializing Foreign Bridge Factory with following parameters:\n')
  console.log(
    `FOREIGN_FACTORY_OWNER: ${FOREIGN_FACTORY_OWNER},
    FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS: ${FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS},
    REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS},
    VALIDATORS: ${VALIDATORS},
    FOREIGN_VALIDATORS_OWNER: ${FOREIGN_VALIDATORS_OWNER},
    FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS: ${FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS},
    FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS" ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE},
    FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT},
    HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX},
    FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER},
    FOREIGN_UPGRADEABLE_ADMIN: ${FOREIGN_UPGRADEABLE_ADMIN}`
  )
  bridgeFactoryForeign.options.address = storageBridgeFactoryForeign.options.address
  const initializeForeignData = await bridgeFactoryForeign.methods
    .initialize(
      FOREIGN_FACTORY_OWNER,
      FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS,
      REQUIRED_NUMBER_OF_VALIDATORS,
      VALIDATORS,
      FOREIGN_VALIDATORS_OWNER,
      FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS,
      FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
      FOREIGN_GAS_PRICE,
      FOREIGN_MAX_AMOUNT_PER_TX,
      HOME_DAILY_LIMIT,
      HOME_MAX_AMOUNT_PER_TX,
      FOREIGN_BRIDGE_OWNER,
      FOREIGN_UPGRADEABLE_ADMIN
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeForeign = await sendRawTxForeign({
    data: initializeForeignData,
    nonce: foreignNonce,
    to: bridgeFactoryForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txInitializeForeign.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nTransferring ownership of FactoryProxy\n')
  const factoryForeignOwnershipData = await storageBridgeFactoryForeign.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txFactoryForeignOwnershipData = await sendRawTxForeign({
    data: factoryForeignOwnershipData,
    nonce: foreignNonce,
    to: storageBridgeFactoryForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txFactoryForeignOwnershipData.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nForeign Deployment Factory completed\n')
  return {
    foreignFactory: {
      address: storageBridgeFactoryForeign.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(storageBridgeFactoryForeign.deployedBlockNumber)
    }
  }
}

module.exports = deployForeign

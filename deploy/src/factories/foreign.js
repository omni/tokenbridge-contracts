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
  FOREIGN_OWNER_MULTISIG,
  FOREIGN_OWNER_FACTORY,
  FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS,
  FOREIGN_UPGRADEABLE_ADMIN_BRIDGE,
  FOREIGN_UPGRADEABLE_ADMIN_FACTORY,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  FOREIGN_GAS_PRICE
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
    `FOREIGN_OWNER_FACTORY: ${FOREIGN_OWNER_FACTORY},
    FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS: ${FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS},
    REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS},
    VALIDATORS: ${VALIDATORS},
    FOREIGN_OWNER_MULTISIG: ${FOREIGN_OWNER_MULTISIG},
    FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS: ${FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS},
    FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS: ${FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS},
    FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS" ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE},
    FOREIGN_UPGRADEABLE_ADMIN_BRIDGE: ${FOREIGN_UPGRADEABLE_ADMIN_BRIDGE}`
  )
  bridgeFactoryForeign.options.address = storageBridgeFactoryForeign.options.address
  const initializeForeignData = await bridgeFactoryForeign.methods
    .initialize(
      FOREIGN_OWNER_FACTORY,
      FOREIGN_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS,
      REQUIRED_NUMBER_OF_VALIDATORS,
      VALIDATORS,
      FOREIGN_OWNER_MULTISIG,
      FOREIGN_UPGRADEABLE_ADMIN_VALIDATORS,
      FOREIGN_BRIDGE_IMPLEMENTATION_ADDRESS,
      FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
      FOREIGN_GAS_PRICE,
      FOREIGN_UPGRADEABLE_ADMIN_BRIDGE
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
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN_FACTORY)
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

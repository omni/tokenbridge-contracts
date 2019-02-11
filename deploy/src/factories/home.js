const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxHome } = require('../deploymentUtils')
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const HomeBridgeFactory = require('../../../build/contracts/HomeBridgeFactory.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const HomeBridge = require('../../../build/contracts/HomeBridgeErcToErc.json')
const BridgeMapper = require('../../../build/contracts/BridgeMapper.json')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_BRIDGE_OWNER,
  HOME_VALIDATORS_OWNER,
  HOME_FACTORY_OWNER,
  HOME_MAPPER_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_MIN_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS,
  HOME_GAS_PRICE,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  DOUBLE_PROXY_IMPLEMENTATIONS
} = env

let {
  HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS,
  HOME_BRIDGE_IMPLEMENTATION_ADDRESS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  if (!HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS) {
    console.log('deploying bridge validators implementation')
    const bridgeValidatorsImplementationHome = await deployContract(BridgeValidators, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'home',
      nonce: homeNonce
    })
    homeNonce++
    HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS = bridgeValidatorsImplementationHome.options.address

    if (DOUBLE_PROXY_IMPLEMENTATIONS) {
      console.log('deploying bridge validators proxy')
      const implProxy = await deployContract(EternalStorageProxy, [], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        network: 'home',
        nonce: homeNonce
      })
      homeNonce++
      
      console.log('\nhooking up eternal storage to implementation')
      const upgradeToImpl = await implProxy.methods
        .upgradeTo('1', HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txUpgradeToImpl = await sendRawTxHome({
        data: upgradeToImpl,
        nonce: homeNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: HOME_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txUpgradeToImpl.status), 1, 'Transaction Failed')
      homeNonce++
      HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS = implProxy.options.address

      console.log('\nTransferring ownership of Proxy\n')
      const ownershipData = await implProxy.methods
        .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txOwnershipData = await sendRawTxHome({
        data: ownershipData,
        nonce: homeNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: HOME_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txOwnershipData.status), 1, 'Transaction Failed')
      homeNonce++
    }
  }
  console.log('[Home] bridge validators implementation address: ', HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS)

  if (!HOME_BRIDGE_IMPLEMENTATION_ADDRESS) {
    console.log('deploying home bridge implementation')
    const homeBridgeImplementationHome = await deployContract(HomeBridge, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'home',
      nonce: homeNonce
    })
    homeNonce++
    HOME_BRIDGE_IMPLEMENTATION_ADDRESS = homeBridgeImplementationHome.options.address

    if (DOUBLE_PROXY_IMPLEMENTATIONS) {
      console.log('deploying home bridge proxy')
      const implProxy = await deployContract(EternalStorageProxy, [], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        network: 'home',
        nonce: homeNonce
      })
      homeNonce++
      
      console.log('\nhooking up eternal storage to implementation')
      const upgradeToImpl = await implProxy.methods
        .upgradeTo('1', HOME_BRIDGE_IMPLEMENTATION_ADDRESS)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txUpgradeToImpl = await sendRawTxHome({
        data: upgradeToImpl,
        nonce: homeNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: HOME_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txUpgradeToImpl.status), 1, 'Transaction Failed')
      homeNonce++
      HOME_BRIDGE_IMPLEMENTATION_ADDRESS = implProxy.options.address

      console.log('\nTransferring ownership of Proxy\n')
      const ownershipData = await implProxy.methods
        .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
        .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
      const txOwnershipData = await sendRawTxHome({
        data: ownershipData,
        nonce: homeNonce,
        to: implProxy.options.address,
        privateKey: deploymentPrivateKey,
        url: HOME_RPC_URL
      })
      assert.equal(Web3Utils.hexToNumber(txOwnershipData.status), 1, 'Transaction Failed')
      homeNonce++
    }
  }
  console.log('[Home] home bridge implementation address: ', HOME_BRIDGE_IMPLEMENTATION_ADDRESS)

  console.log('deploying storage for home bridge factory')
  const storageBridgeFactoryHome = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] BridgeFactory Storage: ', storageBridgeFactoryHome.options.address)
  
  console.log('\ndeploying implementation for home bridge factory')
  const bridgeFactoryHome = await deployContract(HomeBridgeFactory, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })
  homeNonce++
  console.log(
    '[Home] BridgeFactory Implementation: ',
    bridgeFactoryHome.options.address
  )
  console.log('\nhooking up eternal storage to BridgeFactory')
  const upgradeToHomeFactoryData = await storageBridgeFactoryHome.methods
    .upgradeTo('1', bridgeFactoryHome.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToHomeFactory = await sendRawTxHome({
    data: upgradeToHomeFactoryData,
    nonce: homeNonce,
    to: storageBridgeFactoryHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txUpgradeToHomeFactory.status), 1, 'Transaction Failed')
  homeNonce++
  
  console.log('\ninitializing Home Bridge Factory with following parameters:\n')
  console.log(
    `HOME_FACTORY_OWNER: ${HOME_FACTORY_OWNER},
    HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS: ${HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS},
    REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS},
    VALIDATORS: ${VALIDATORS},
    HOME_VALIDATORS_OWNER: ${HOME_VALIDATORS_OWNER},
    HOME_BRIDGE_IMPLEMENTATION_ADDRESS: ${HOME_BRIDGE_IMPLEMENTATION_ADDRESS},
    HOME_REQUIRED_BLOCK_CONFIRMATIONS: ${HOME_REQUIRED_BLOCK_CONFIRMATIONS},
    HOME_GAS_PRICE: ${HOME_GAS_PRICE},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT},
    HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX},
    HOME_MIN_AMOUNT_PER_TX: ${HOME_MIN_AMOUNT_PER_TX},
    FOREIGN_DAILY_LIMIT: ${FOREIGN_DAILY_LIMIT},
    FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX},
    HOME_BRIDGE_OWNER: ${HOME_BRIDGE_OWNER},
    HOME_UPGRADEABLE_ADMIN: ${HOME_UPGRADEABLE_ADMIN}`
  )
  bridgeFactoryHome.options.address = storageBridgeFactoryHome.options.address
  const initializeHomeData = await bridgeFactoryHome.methods
    .initialize(
      HOME_FACTORY_OWNER,
      HOME_BRIDGE_VALIDATORS_IMPLEMENTATION_ADDRESS,
      REQUIRED_NUMBER_OF_VALIDATORS,
      VALIDATORS,
      HOME_VALIDATORS_OWNER,
      HOME_BRIDGE_IMPLEMENTATION_ADDRESS,
      HOME_REQUIRED_BLOCK_CONFIRMATIONS,
      HOME_GAS_PRICE,
      HOME_DAILY_LIMIT,
      HOME_MAX_AMOUNT_PER_TX,
      HOME_MIN_AMOUNT_PER_TX,
      FOREIGN_DAILY_LIMIT,
      FOREIGN_MAX_AMOUNT_PER_TX,
      HOME_BRIDGE_OWNER,
      HOME_UPGRADEABLE_ADMIN
    )
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeHome = await sendRawTxHome({
    data: initializeHomeData,
    nonce: homeNonce,
    to: bridgeFactoryHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txInitializeHome.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\nTransferring ownership of FactoryProxy\n')
  const factoryHomeOwnershipData = await storageBridgeFactoryHome.methods
    .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txFactoryHomeOwnershipData = await sendRawTxHome({
    data: factoryHomeOwnershipData,
    nonce: homeNonce,
    to: storageBridgeFactoryHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txFactoryHomeOwnershipData.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('deploying storage for bridge mapper')
  const storageBridgeMapperHome = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })
  homeNonce++
  console.log('[Home] BridgeMapper Storage: ', storageBridgeMapperHome.options.address)
  
  console.log('\ndeploying implementation for bridge mapper')
  const bridgeMapperHome = await deployContract(BridgeMapper, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })
  homeNonce++
  console.log(
    '[Home] BridgeMapper Implementation: ',
    bridgeMapperHome.options.address
  )

  console.log('\nhooking up eternal storage to BridgeMapper')
  const upgradeToBridgeMapperData = await storageBridgeMapperHome.methods
    .upgradeTo('1', bridgeMapperHome.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToBridgeMapper = await sendRawTxHome({
    data: upgradeToBridgeMapperData,
    nonce: homeNonce,
    to: storageBridgeMapperHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txUpgradeToBridgeMapper.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\ninitializing BridgeMapper:')
  bridgeMapperHome.options.address = storageBridgeMapperHome.options.address
  const initializeBridgeMapperData = await bridgeMapperHome.methods
    .initialize(HOME_MAPPER_OWNER)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitializeBridgeMapper = await sendRawTxHome({
    data: initializeBridgeMapperData,
    nonce: homeNonce,
    to: bridgeMapperHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txInitializeBridgeMapper.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\nTransferring ownership of MapperProxy\n')
  const mapperOwnershipData = await storageBridgeMapperHome.methods
    .transferProxyOwnership(HOME_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txMapperOwnershipData = await sendRawTxHome({
    data: mapperOwnershipData,
    nonce: homeNonce,
    to: storageBridgeMapperHome.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txMapperOwnershipData.status), 1, 'Transaction Failed')
  homeNonce++

  console.log('\nHome Deployment Factory completed\n')
  return {
    homeFactory: {
      address: storageBridgeFactoryHome.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(storageBridgeFactoryHome.deployedBlockNumber)
    },
    mapper: {
      address: storageBridgeMapperHome.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(storageBridgeMapperHome.deployedBlockNumber)
    }
  }
}
module.exports = deployHome

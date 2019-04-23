const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const {
  deployContract,
  privateKeyToAddress,
  sendRawTxForeign,
  logValidatorsAndRewardAccounts
} = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json')
const ERC677BridgeTokenRewardable = require('../../../build/contracts/ERC677BridgeTokenRewardable.json')
const EternalStorageProxy = require('../../../build/contracts/EternalStorageProxy.json')
const BridgeValidators = require('../../../build/contracts/BridgeValidators.json')
const RewardableValidators = require('../../../build/contracts/RewardableValidators.json')
const FeeManagerNativeToErc = require('../../../build/contracts/FeeManagerNativeToErc.json')
const ForeignBridge = require('../../../build/contracts/ForeignBridgeNativeToErc.json')

const VALIDATORS = env.VALIDATORS.split(' ')
const VALIDATORS_REWARD_ACCOUNTS = env.VALIDATORS_REWARD_ACCOUNTS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  FOREIGN_GAS_PRICE,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_VALIDATORS_OWNER,
  FOREIGN_UPGRADEABLE_ADMIN,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX,
  DEPLOY_REWARDABLE_TOKEN,
  BLOCK_REWARD_ADDRESS,
  DPOS_STAKING_ADDRESS,
  FOREIGN_REWARDABLE,
  HOME_TRANSACTIONS_FEE
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const isRewardableBridge = FOREIGN_REWARDABLE === 'ONE_DIRECTION'

async function deployForeign() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('\n[Foreign] deploying BRIDGEABLE_TOKEN_SYMBOL token')
  const erc677bridgeToken = await deployContract(
    DEPLOY_REWARDABLE_TOKEN ? ERC677BridgeTokenRewardable : ERC677BridgeToken,
    [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
  )
  foreignNonce++
  console.log('[Foreign] BRIDGEABLE_TOKEN_SYMBOL: ', erc677bridgeToken.options.address)

  console.log('deploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsContract = isRewardableBridge ? RewardableValidators : BridgeValidators
  const bridgeValidatorsForeign = await deployContract(bridgeValidatorsContract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log(
    '[Foreign] BridgeValidators Implementation: ',
    bridgeValidatorsForeign.options.address
  )

  console.log('\nhooking up eternal storage to BridgeValidators')
  const upgradeToBridgeVForeignData = await storageValidatorsForeign.methods
    .upgradeTo('1', bridgeValidatorsForeign.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToBridgeVForeign = await sendRawTxForeign({
    data: upgradeToBridgeVForeignData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToBridgeVForeign.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\ninitializing Foreign Bridge Validators with following parameters:\n')
  bridgeValidatorsForeign.options.address = storageValidatorsForeign.options.address

  let initializeForeignData

  if (isRewardableBridge) {
    console.log(
      `REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, FOREIGN_VALIDATORS_OWNER: ${FOREIGN_VALIDATORS_OWNER}`
    )
    logValidatorsAndRewardAccounts(VALIDATORS, VALIDATORS_REWARD_ACCOUNTS)
    initializeForeignData = await bridgeValidatorsForeign.methods
      .initialize(
        REQUIRED_NUMBER_OF_VALIDATORS,
        VALIDATORS,
        VALIDATORS_REWARD_ACCOUNTS,
        FOREIGN_VALIDATORS_OWNER
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  } else {
    console.log(
      `REQUIRED_NUMBER_OF_VALIDATORS: ${REQUIRED_NUMBER_OF_VALIDATORS}, VALIDATORS: ${VALIDATORS}, FOREIGN_VALIDATORS_OWNER: ${FOREIGN_VALIDATORS_OWNER}`
    )
    initializeForeignData = await bridgeValidatorsForeign.methods
      .initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, FOREIGN_VALIDATORS_OWNER)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  }

  const txInitializeForeign = await sendRawTxForeign({
    data: initializeForeignData,
    nonce: foreignNonce,
    to: bridgeValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeForeign.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nTransferring ownership of ValidatorsProxy\n')
  const validatorsForeignOwnershipData = await storageValidatorsForeign.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txValidatorsForeignOwnershipData = await sendRawTxForeign({
    data: validatorsForeignOwnershipData,
    nonce: foreignNonce,
    to: storageValidatorsForeign.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txValidatorsForeignOwnershipData.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log(
    '[Foreign] ForeignBridge Implementation: ',
    foreignBridgeImplementation.options.address
  )

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  const upgradeToForeignBridgeData = await foreignBridgeStorage.methods
    .upgradeTo('1', foreignBridgeImplementation.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txUpgradeToForeignBridge = await sendRawTxForeign({
    data: upgradeToForeignBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(
    Web3Utils.hexToNumber(txUpgradeToForeignBridge.status),
    1,
    'Transaction Failed'
  )
  foreignNonce++

  let initializeFBridgeData
  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address

  if (isRewardableBridge) {
    console.log('\ndeploying implementation for fee manager')
    const feeManager = await deployContract(FeeManagerNativeToErc, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'foreign',
      nonce: foreignNonce
    })
    console.log('[Foreign] feeManager Implementation: ', feeManager.options.address)
    foreignNonce++

    const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')

    console.log('\ninitializing Foreign Bridge with fee contract:\n')
    console.log(`Foreign Validators: ${storageValidatorsForeign.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(
      FOREIGN_DAILY_LIMIT
    )} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER},
  Fee Manager: ${feeManager.options.address},
  Home Fee: ${homeFeeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%`)

    initializeFBridgeData = await foreignBridgeImplementation.methods
      .rewardableInitialize(
        storageValidatorsForeign.options.address,
        erc677bridgeToken.options.address,
        FOREIGN_DAILY_LIMIT,
        FOREIGN_MAX_AMOUNT_PER_TX,
        FOREIGN_MIN_AMOUNT_PER_TX,
        FOREIGN_GAS_PRICE,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        FOREIGN_BRIDGE_OWNER,
        feeManager.options.address,
        homeFeeInWei
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  } else {
    console.log('\ninitializing Foreign Bridge with following parameters:\n')
    console.log(`Foreign Validators: ${storageValidatorsForeign.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(
      FOREIGN_DAILY_LIMIT
    )} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      HOME_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER}
  `)

    initializeFBridgeData = await foreignBridgeImplementation.methods
      .initialize(
        storageValidatorsForeign.options.address,
        erc677bridgeToken.options.address,
        FOREIGN_DAILY_LIMIT,
        FOREIGN_MAX_AMOUNT_PER_TX,
        FOREIGN_MIN_AMOUNT_PER_TX,
        FOREIGN_GAS_PRICE,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        HOME_DAILY_LIMIT,
        HOME_MAX_AMOUNT_PER_TX,
        FOREIGN_BRIDGE_OWNER
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  }

  const txInitializeBridge = await sendRawTxForeign({
    data: initializeFBridgeData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitializeBridge.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nset bridge contract on ERC677BridgeToken')
  const setBridgeContractData = await erc677bridgeToken.methods
    .setBridgeContract(foreignBridgeStorage.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const setBridgeContract = await sendRawTxForeign({
    data: setBridgeContractData,
    nonce: foreignNonce,
    to: erc677bridgeToken.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(setBridgeContract.status), 1, 'Transaction Failed')
  foreignNonce++

  if (DEPLOY_REWARDABLE_TOKEN) {
    console.log('\nset BlockReward contract on ERC677BridgeTokenRewardable')
    const setBlockRewardContractData = await erc677bridgeToken.methods
      .setBlockRewardContract(BLOCK_REWARD_ADDRESS)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const setBlockRewardContract = await sendRawTxForeign({
      data: setBlockRewardContractData,
      nonce: foreignNonce,
      to: erc677bridgeToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(
      Web3Utils.hexToNumber(setBlockRewardContract.status),
      1,
      'Transaction Failed'
    )
    foreignNonce++

    console.log('\nset Staking contract on ERC677BridgeTokenRewardable')
    const setStakingContractData = await erc677bridgeToken.methods
      .setStakingContract(DPOS_STAKING_ADDRESS)
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
    const setStakingContract = await sendRawTxForeign({
      data: setStakingContractData,
      nonce: foreignNonce,
      to: erc677bridgeToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    assert.strictEqual(Web3Utils.hexToNumber(setStakingContract.status), 1, 'Transaction Failed')
    foreignNonce++
  }

  console.log('transferring ownership of ERC677BridgeToken token to foreignBridge contract')
  const txOwnershipData = await erc677bridgeToken.methods
    .transferOwnership(foreignBridgeStorage.options.address)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txOwnership = await sendRawTxForeign({
    data: txOwnershipData,
    nonce: foreignNonce,
    to: erc677bridgeToken.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txOwnership.status), 1, 'Transaction Failed')
  foreignNonce++

  const bridgeOwnershipData = await foreignBridgeStorage.methods
    .transferProxyOwnership(FOREIGN_UPGRADEABLE_ADMIN)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txBridgeOwnershipData = await sendRawTxForeign({
    data: bridgeOwnershipData,
    nonce: foreignNonce,
    to: foreignBridgeStorage.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txBridgeOwnershipData.status), 1, 'Transaction Failed')
  foreignNonce++

  console.log('\nForeign Deployment Bridge completed\n')
  return {
    foreignBridge: {
      address: foreignBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(foreignBridgeStorage.deployedBlockNumber)
    },
    erc677: { address: erc677bridgeToken.options.address }
  }
}

module.exports = deployForeign

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
  transferOwnership,
  setBridgeContract,
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')
const {
  foreignContracts: {
    EternalStorageProxy,
    BridgeValidators,
    RewardableValidators,
    ForeignBridgeNativeToErc: ForeignBridge,
    ERC677BridgeToken,
    ERC677BridgeTokenRewardable,
    FeeManagerNativeToErc
  }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

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
  HOME_TRANSACTIONS_FEE,
  FOREIGN_TO_HOME_DECIMAL_SHIFT
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const foreignToHomeDecimalShift = FOREIGN_TO_HOME_DECIMAL_SHIFT || 0

const isRewardableBridge = FOREIGN_REWARDABLE === 'ONE_DIRECTION'

let VALIDATORS_REWARD_ACCOUNTS = []

if (isRewardableBridge) {
  VALIDATORS_REWARD_ACCOUNTS = env.VALIDATORS_REWARD_ACCOUNTS.split(' ')
}

async function initializeBridge({ validatorsBridge, bridge, erc677bridgeToken, initialNonce, homeBridgeAddress }) {
  let nonce = initialNonce
  let initializeFBridgeData

  if (isRewardableBridge) {
    console.log('\ndeploying implementation for fee manager')
    const feeManager = await deployContract(FeeManagerNativeToErc, [], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'foreign',
      nonce
    })
    console.log('[Foreign] feeManager Implementation: ', feeManager.options.address)
    nonce++

    const homeFeeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')

    console.log('\ninitializing Foreign Bridge with fee contract:\n')
    console.log(`Foreign Validators: ${validatorsBridge.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER},
  Fee Manager: ${feeManager.options.address},
  Home Fee: ${homeFeeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%,
  FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift}
  Home bridge Address: ${homeBridgeAddress}`)

    initializeFBridgeData = await bridge.methods
      .rewardableInitialize(
        validatorsBridge.options.address,
        erc677bridgeToken.options.address,
        [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString(), FOREIGN_MIN_AMOUNT_PER_TX.toString()],
        FOREIGN_GAS_PRICE,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString()],
        FOREIGN_BRIDGE_OWNER,
        feeManager.options.address,
        homeFeeInWei,
        foreignToHomeDecimalShift,
        homeBridgeAddress
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  } else {
    console.log('\ninitializing Foreign Bridge with following parameters:\n')
    console.log(`Foreign Validators: ${validatorsBridge.options.address},
  FOREIGN_DAILY_LIMIT : ${FOREIGN_DAILY_LIMIT} which is ${Web3Utils.fromWei(FOREIGN_DAILY_LIMIT)} in eth,
  FOREIGN_MAX_AMOUNT_PER_TX: ${FOREIGN_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MAX_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_MIN_AMOUNT_PER_TX: ${FOREIGN_MIN_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(
      FOREIGN_MIN_AMOUNT_PER_TX
    )} in eth,
  FOREIGN_GAS_PRICE: ${FOREIGN_GAS_PRICE}, FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS : ${FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS},
    HOME_DAILY_LIMIT: ${HOME_DAILY_LIMIT} which is ${Web3Utils.fromWei(HOME_DAILY_LIMIT)} in eth,
  HOME_MAX_AMOUNT_PER_TX: ${HOME_MAX_AMOUNT_PER_TX} which is ${Web3Utils.fromWei(HOME_MAX_AMOUNT_PER_TX)} in eth,
  FOREIGN_BRIDGE_OWNER: ${FOREIGN_BRIDGE_OWNER},
  FOREIGN_TO_HOME_DECIMAL_SHIFT: ${foreignToHomeDecimalShift}
  Home bridge Address: ${homeBridgeAddress}
  `)

    initializeFBridgeData = await bridge.methods
      .initialize(
        validatorsBridge.options.address,
        erc677bridgeToken.options.address,
        [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString(), FOREIGN_MIN_AMOUNT_PER_TX.toString()],
        FOREIGN_GAS_PRICE,
        FOREIGN_REQUIRED_BLOCK_CONFIRMATIONS,
        [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString()],
        FOREIGN_BRIDGE_OWNER,
        foreignToHomeDecimalShift,
        homeBridgeAddress
      )
      .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  }

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

async function deployForeign(homeBridgeAddress) {
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('========================================')
  console.log('deploying ForeignBridge')
  console.log('========================================\n')

  console.log('\n[Foreign] deploying bridgeable token')
  const args = [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS]
  if (DEPLOY_REWARDABLE_TOKEN) {
    const chainId = await web3Foreign.eth.getChainId()
    assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
    args.push(chainId)
  }
  const erc677bridgeToken = await deployContract(
    DEPLOY_REWARDABLE_TOKEN ? ERC677BridgeTokenRewardable : ERC677BridgeToken,
    args,
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce }
  )
  nonce++
  console.log('[Foreign] Bridgeable Token: ', erc677bridgeToken.options.address)

  console.log('\ndeploying storage for foreign validators')
  const storageValidatorsForeign = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] BridgeValidators Storage: ', storageValidatorsForeign.options.address)

  console.log('\ndeploying implementation for foreign validators')
  const bridgeValidatorsContract = isRewardableBridge ? RewardableValidators : BridgeValidators
  const bridgeValidatorsForeign = await deployContract(bridgeValidatorsContract, [], {
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
    isRewardableBridge,
    requiredNumber: REQUIRED_NUMBER_OF_VALIDATORS,
    validators: VALIDATORS,
    rewardAccounts: VALIDATORS_REWARD_ACCOUNTS,
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

  console.log('\ndeploying foreignBridge storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignBridge Storage: ', foreignBridgeStorage.options.address)

  console.log('\ndeploying foreignBridge implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] ForeignBridge Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\nhooking up ForeignBridge storage to ForeignBridge implementation')
  await upgradeProxy({
    proxy: foreignBridgeStorage,
    implementationAddress: foreignBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  foreignBridgeImplementation.options.address = foreignBridgeStorage.options.address
  nonce = await initializeBridge({
    validatorsBridge: storageValidatorsForeign,
    bridge: foreignBridgeImplementation,
    erc677bridgeToken,
    initialNonce: nonce,
    homeBridgeAddress
  })

  console.log('\nset bridge contract on ERC677BridgeToken')
  await setBridgeContract({
    contract: erc677bridgeToken,
    bridgeAddress: foreignBridgeStorage.options.address,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  if (DEPLOY_REWARDABLE_TOKEN) {
    console.log('\nset BlockReward contract on ERC677BridgeTokenRewardable')
    const setBlockRewardContractData = await erc677bridgeToken.methods
      .setBlockRewardContract(BLOCK_REWARD_ADDRESS)
      .encodeABI()
    const setBlockRewardContract = await sendRawTxForeign({
      data: setBlockRewardContractData,
      nonce,
      to: erc677bridgeToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    if (setBlockRewardContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setBlockRewardContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677bridgeToken.methods.blockRewardContract().call, BLOCK_REWARD_ADDRESS)
    }
    nonce++

    console.log('\nset Staking contract on ERC677BridgeTokenRewardable')
    const setStakingContractData = await erc677bridgeToken.methods.setStakingContract(DPOS_STAKING_ADDRESS).encodeABI()
    const setStakingContract = await sendRawTxForeign({
      data: setStakingContractData,
      nonce,
      to: erc677bridgeToken.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    if (setStakingContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setStakingContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677bridgeToken.methods.validatorSetContract().call, DPOS_STAKING_ADDRESS)
    }
    nonce++
  }

  console.log('transferring ownership of ERC677BridgeToken token to foreignBridge contract')
  await transferOwnership({
    contract: erc677bridgeToken,
    newOwner: foreignBridgeStorage.options.address,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('transferring proxy ownership to multisig for foreign bridge Proxy contract')
  await transferProxyOwnership({
    proxy: foreignBridgeStorage,
    newOwner: FOREIGN_UPGRADEABLE_ADMIN,
    nonce,
    url: FOREIGN_RPC_URL
  })

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

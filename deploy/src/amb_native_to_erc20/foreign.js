const assert = require('assert')
const Web3Utils = require('web3-utils')
const { web3Foreign, FOREIGN_RPC_URL, deploymentPrivateKey } = require('../web3')
const { ZERO_ADDRESS } = require('../constants')
const {
  deployContract,
  privateKeyToAddress,
  upgradeProxy,
  setBridgeContract,
  sendRawTxForeign,
  transferOwnership,
  assertStateWithRetry
} = require('../deploymentUtils')
const {
  foreignContracts: {
    EternalStorageProxy,
    ForeignAMBNativeToErc20: ForeignBridge,
    ForeignFeeManagerAMBNativeToErc20,
    ERC677BridgeTokenRewardable,
    ERC677BridgeTokenPermittable
  }
} = require('../loadContracts')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_REWARDABLE,
  DEPLOY_REWARDABLE_TOKEN,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  BLOCK_REWARD_ADDRESS,
  DPOS_STAKING_ADDRESS,
  FOREIGN_BRIDGE_OWNER,
  HOME_TRANSACTIONS_FEE,
  FOREIGN_MEDIATOR_REWARD_ACCOUNTS
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

const isRewardableBridge = FOREIGN_REWARDABLE === 'ONE_DIRECTION'

async function deployForeign() {
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  let feeManagerAddress = ZERO_ADDRESS

  console.log('\n[Foreign] Deploying Bridge Mediator storage\n')
  const foreignBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] Bridge Mediator Storage: ', foreignBridgeStorage.options.address)

  console.log('\n[Foreign] Deploying Bridge Mediator implementation\n')
  const foreignBridgeImplementation = await deployContract(ForeignBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] Bridge Mediator Implementation: ', foreignBridgeImplementation.options.address)

  console.log('\n[Foreign] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: foreignBridgeStorage,
    implementationAddress: foreignBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  console.log('\n[Foreign] Deploying Bridgeable token')
  const erc677Contract = DEPLOY_REWARDABLE_TOKEN ? ERC677BridgeTokenRewardable : ERC677BridgeTokenPermittable
  const chainId = await web3Foreign.eth.getChainId()
  assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
  const args = [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS, chainId]
  const erc677token = await deployContract(erc677Contract, args, {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  nonce++
  console.log('[Foreign] Bridgeable Token: ', erc677token.options.address)

  console.log('\n[Foreign] Set Bridge Mediator contract on Bridgeable token')
  await setBridgeContract({
    contract: erc677token,
    bridgeAddress: foreignBridgeStorage.options.address,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  if (DEPLOY_REWARDABLE_TOKEN) {
    console.log('\n[Foreign] Set BlockReward contract on Bridgeable token contract')
    const setBlockRewardContractData = await erc677token.methods
      .setBlockRewardContract(BLOCK_REWARD_ADDRESS)
      .encodeABI()
    const setBlockRewardContract = await sendRawTxForeign({
      data: setBlockRewardContractData,
      nonce,
      to: erc677token.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    if (setBlockRewardContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setBlockRewardContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677token.methods.blockRewardContract().call, BLOCK_REWARD_ADDRESS)
    }
    nonce++

    console.log('\n[Foreign] Set Staking contract on Bridgeable token contract')
    const setStakingContractData = await erc677token.methods.setStakingContract(DPOS_STAKING_ADDRESS).encodeABI()
    const setStakingContract = await sendRawTxForeign({
      data: setStakingContractData,
      nonce,
      to: erc677token.options.address,
      privateKey: deploymentPrivateKey,
      url: FOREIGN_RPC_URL
    })
    if (setStakingContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setStakingContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677token.methods.stakingContract().call, DPOS_STAKING_ADDRESS)
    }
    nonce++
  }

  console.log('[Foreign] Transferring ownership of Bridgeable token to Bridge Mediator contract')
  await transferOwnership({
    contract: erc677token,
    newOwner: foreignBridgeStorage.options.address,
    nonce,
    url: FOREIGN_RPC_URL
  })
  nonce++

  if (isRewardableBridge) {
    const feeInWei = Web3Utils.toWei(HOME_TRANSACTIONS_FEE.toString(), 'ether')
    const rewardList = FOREIGN_MEDIATOR_REWARD_ACCOUNTS.split(' ')

    console.log('\n[Foreign] Deploying Fee Manager')
    console.log(`
    OWNER: ${FOREIGN_BRIDGE_OWNER},
    Fee: ${feeInWei} which is ${HOME_TRANSACTIONS_FEE * 100}%
    Mediator: ${foreignBridgeStorage.options.address}
  `)
    rewardList.forEach((account, index) => {
      console.log(`${index + 1}: ${account}`)
    })
    const feeManagerImpl = await deployContract(
      ForeignFeeManagerAMBNativeToErc20,
      [FOREIGN_BRIDGE_OWNER, feeInWei, rewardList, foreignBridgeStorage.options.address, erc677token.options.address],
      {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        network: 'foreign',
        nonce
      }
    )
    console.log('[Home] Fee Manager : ', feeManagerImpl.options.address)
    feeManagerAddress = feeManagerImpl.options.address
    nonce++
  }

  console.log('\nForeign part of Native-to-ERC20 bridge deployed\n')
  return {
    foreignBridgeMediator: { address: foreignBridgeStorage.options.address },
    foreignFeeManager: { address: feeManagerAddress },
    bridgeableErc677: { address: erc677token.options.address }
  }
}

module.exports = deployForeign

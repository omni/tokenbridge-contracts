const assert = require('assert')
const Web3Utils = require('web3-utils')
const { web3Home, HOME_RPC_URL, deploymentPrivateKey } = require('../web3')
const {
  deployContract,
  privateKeyToAddress,
  upgradeProxy,
  setBridgeContract,
  transferOwnership,
  sendRawTxHome,
  assertStateWithRetry
} = require('../deploymentUtils')
const {
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  DEPLOY_REWARDABLE_TOKEN,
  BLOCK_REWARD_ADDRESS,
  DPOS_STAKING_ADDRESS,
  RELATIVE_DAILY_LIMIT,
} = require('../loadEnv')

const {
  homeContracts: {
    EternalStorageProxy,
    HomeAMBErc677ToErc677: HomeBridgeAbsoluteDailyLimit,
    HomeAMBErc677ToErc677RelativeDailyLimit: HomeBridgeRelativeDailyLimit,
    ERC677BridgeToken,
    ERC677BridgeTokenRewardable
  }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('\n[Home] Deploying homeBridge storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeBridge Storage: ', homeBridgeStorage.options.address)

  console.log('\n[Home] Deploying homeBridge implementation\n')
  const HomeBridgeContract = RELATIVE_DAILY_LIMIT ? HomeBridgeRelativeDailyLimit : HomeBridgeAbsoluteDailyLimit
  const homeBridgeImplementation = await deployContract(HomeBridgeContract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] HomeBridge Implementation: ', homeBridgeImplementation.options.address)

  console.log('\n[Home] Hooking up HomeBridge storage to HomeBridge implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\n[Home] deploying Bridgeble token')
  const erc677Contract = DEPLOY_REWARDABLE_TOKEN ? ERC677BridgeTokenRewardable : ERC677BridgeToken
  const erc677token = await deployContract(
    erc677Contract,
    [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'home', nonce }
  )
  nonce++
  console.log('[Home] Bridgeble Token: ', erc677token.options.address)

  console.log('\n[Home] Set bridge contract on ERC677BridgeToken')
  await setBridgeContract({
    contract: erc677token,
    bridgeAddress: homeBridgeStorage.options.address,
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  if (DEPLOY_REWARDABLE_TOKEN) {
    console.log('\n[Home] Set BlockReward contract on ERC677BridgeTokenRewardable')
    const setBlockRewardContractData = await erc677token.methods
      .setBlockRewardContract(BLOCK_REWARD_ADDRESS)
      .encodeABI()
    const setBlockRewardContract = await sendRawTxHome({
      data: setBlockRewardContractData,
      nonce,
      to: erc677token.options.address,
      privateKey: deploymentPrivateKey,
      url: HOME_RPC_URL
    })
    if (setBlockRewardContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setBlockRewardContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677token.methods.blockRewardContract().call, BLOCK_REWARD_ADDRESS)
    }
    nonce++

    console.log('\n[Home] Set Staking contract on ERC677BridgeTokenRewardable')
    const setStakingContractData = await erc677token.methods.setStakingContract(DPOS_STAKING_ADDRESS).encodeABI()
    const setStakingContract = await sendRawTxHome({
      data: setStakingContractData,
      nonce,
      to: erc677token.options.address,
      privateKey: deploymentPrivateKey,
      url: HOME_RPC_URL
    })
    if (setStakingContract.status) {
      assert.strictEqual(Web3Utils.hexToNumber(setStakingContract.status), 1, 'Transaction Failed')
    } else {
      await assertStateWithRetry(erc677token.methods.stakingContract().call, DPOS_STAKING_ADDRESS)
    }
    nonce++
  }

  console.log('[Home] Transferring ownership of Bridgeable token to homeBridge contract')
  await transferOwnership({
    contract: erc677token,
    newOwner: homeBridgeStorage.options.address,
    nonce,
    url: HOME_RPC_URL
  })

  console.log('\nHome Bridge deployment completed\n')
  return {
    homeBridge: {
      address: homeBridgeStorage.options.address,
      deployedBlockNumber: Web3Utils.hexToNumber(homeBridgeStorage.deployedBlockNumber)
    },
    erc677: { address: erc677token.options.address }
  }
}

module.exports = deployHome

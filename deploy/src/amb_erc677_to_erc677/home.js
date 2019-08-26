const Web3Utils = require('web3-utils')
const { web3Home, HOME_RPC_URL } = require('../web3')
const {
  deployContract,
  privateKeyToAddress,
  upgradeProxy,
  setBridgeContract,
  transferOwnership
} = require('../deploymentUtils')
const {
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS,
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY
} = require('../loadEnv')

const {
  homeContracts: { EternalStorageProxy, HomeAMBErc677ToErc677: HomeBridge, ERC677BridgeToken }
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
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
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
  const erc677token = await deployContract(
    ERC677BridgeToken,
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

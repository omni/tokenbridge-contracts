const assert = require('assert')
const { web3Home, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  HOME_ERC677_TOKEN_IMAGE,
  HOME_TOKEN_FACTORY,
  HOME_BRIDGE_OWNER
} = require('../loadEnv')

const {
  homeContracts: {
    EternalStorageProxy,
    HomeMultiAMBErc20ToErc677: HomeBridge,
    ERC677BridgeTokenPermittable,
    TokenFactory
  }
} = require('../loadContracts')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployHome() {
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  console.log('\n[Home] Deploying Bridge Mediator storage\n')
  const homeBridgeStorage = await deployContract(EternalStorageProxy, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Storage: ', homeBridgeStorage.options.address)

  let tokenFactory = HOME_TOKEN_FACTORY
  if (!tokenFactory) {
    let homeTokenImage = HOME_ERC677_TOKEN_IMAGE
    if (!homeTokenImage) {
      console.log('\n[Home] Deploying new ERC677 token image')
      const chainId = await web3Home.eth.getChainId()
      assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
      const erc677token = await deployContract(ERC677BridgeTokenPermittable, ['', '', 0, chainId], {
        from: DEPLOYMENT_ACCOUNT_ADDRESS,
        nonce: nonce++
      })
      homeTokenImage = erc677token.options.address
      console.log('\n[Home] New ERC677 token image has been deployed: ', homeTokenImage)
    } else {
      console.log('\n[Home] Using existing ERC677 token image: ', homeTokenImage)
    }
    console.log('\n[Home] Deploying new token factory')
    const factory = await deployContract(TokenFactory, [HOME_BRIDGE_OWNER, homeTokenImage], {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      nonce: nonce++
    })
    tokenFactory = factory.options.address
    console.log('\n[Home] New token factory has been deployed: ', tokenFactory)
  } else {
    console.log('\n[Home] Using existing token factory: ', tokenFactory)
  }

  console.log('\n[Home] Deploying Bridge Mediator implementation\n')
  const homeBridgeImplementation = await deployContract(HomeBridge, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    nonce
  })
  nonce++
  console.log('[Home] Bridge Mediator Implementation: ', homeBridgeImplementation.options.address)

  console.log('\n[Home] Hooking up Mediator storage to Mediator implementation')
  await upgradeProxy({
    proxy: homeBridgeStorage,
    implementationAddress: homeBridgeImplementation.options.address,
    version: '1',
    nonce,
    url: HOME_RPC_URL
  })
  nonce++

  console.log('\nHome part of MULTI_AMB_ERC20_TO_ERC677 bridge deployed\n')
  return {
    homeBridgeMediator: { address: homeBridgeStorage.options.address },
    tokenFactory: { address: tokenFactory }
  }
}

module.exports = deployHome

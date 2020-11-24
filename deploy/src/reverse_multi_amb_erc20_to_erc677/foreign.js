const assert = require('assert')
const { web3Foreign, FOREIGN_RPC_URL } = require('../web3')
const {
  deployContract,
  privateKeyToAddress,
  upgradeProxy
} = require('../deploymentUtils')
const {
  foreignContracts: { EternalStorageProxy, HomeMultiAMBErc20ToErc677: ForeignBridge, ERC677BridgeTokenPermittable }
} = require('../loadContracts')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_ERC677_TOKEN_IMAGE
} = require('../loadEnv')

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployForeign() {
  let nonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

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

  let foreignTokenImage = FOREIGN_ERC677_TOKEN_IMAGE
  if (FOREIGN_ERC677_TOKEN_IMAGE === "") {
    console.log('\n[Foreign] Deploying new ERC677 token image')
    const chainId = await web3Foreign.eth.getChainId()
    assert.strictEqual(chainId > 0, true, 'Invalid chain ID')
    const erc677token = await deployContract(
      ERC677BridgeTokenPermittable,
      ["", "", 0, chainId],
      { from: DEPLOYMENT_ACCOUNT_ADDRESS, nonce, network: 'foreign' }
    )
    foreignTokenImage = erc677token.options.address
    console.log('\n[Foreign] New ERC677 token image has been deployed: ', foreignTokenImage)
  } else {
    console.log('\n[Foreign] Using existing ERC677 token image: ', foreignTokenImage)
  }

  console.log('\nForeign part of REVERSE_MULTI_AMB_ERC20_TO_ERC677 bridge deployed\n')
  return {
    foreignBridgeMediator: { address: foreignBridgeStorage.options.address },
    foreignTokenImage: { address: foreignTokenImage }
  }
}

module.exports = deployForeign

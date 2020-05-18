const { web3Foreign, FOREIGN_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  foreignContracts: { EternalStorageProxy, ForeignAMBErc677ToErc677: ForeignBridge }
} = require('../loadContracts')
const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = require('../loadEnv')

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

  console.log('\nForeign part of ERC677-to-ERC677 bridge deployed\n')
  return {
    foreignBridgeMediator: { address: foreignBridgeStorage.options.address }
  }
}

module.exports = deployForeign

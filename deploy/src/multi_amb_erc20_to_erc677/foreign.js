const { web3Foreign, FOREIGN_RPC_URL } = require('../web3')
const {
  deployContract,
  privateKeyToAddress,
  upgradeProxy
} = require('../deploymentUtils')
const {
  foreignContracts: { EternalStorageProxy, ForeignMultiAMBErc20ToErc677: ForeignBridge, MultiTokenBridgeLimitsManager }
} = require('../loadContracts')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  FOREIGN_BRIDGE_OWNER,
  FOREIGN_DAILY_LIMIT,
  FOREIGN_MAX_AMOUNT_PER_TX,
  FOREIGN_MIN_AMOUNT_PER_TX,
  HOME_DAILY_LIMIT,
  HOME_MAX_AMOUNT_PER_TX
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

  console.log('\n[Foreign] Deploying new limits manager')
  const limitsManager = (await deployContract(
    MultiTokenBridgeLimitsManager,
    [
      foreignBridgeStorage.options.address,
      FOREIGN_BRIDGE_OWNER,
      [FOREIGN_DAILY_LIMIT.toString(), FOREIGN_MAX_AMOUNT_PER_TX.toString(), FOREIGN_MIN_AMOUNT_PER_TX.toString()],
      [HOME_DAILY_LIMIT.toString(), HOME_MAX_AMOUNT_PER_TX.toString()]
    ],
    {
      from: DEPLOYMENT_ACCOUNT_ADDRESS,
      network: 'foreign',
      nonce: nonce++
    }
  )).options.address
  console.log('\n[Foreign] New limits manager has been deployed: ', limitsManager)

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

  console.log('\nForeign part of MULTI_AMB_ERC20_TO_ERC677 bridge deployed\n')
  return {
    foreignBridgeMediator: { address: foreignBridgeStorage.options.address },
    limitsManager: { address: limitsManager }
  }
}

module.exports = deployForeign

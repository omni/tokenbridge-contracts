const Web3Utils = require('web3-utils')
const { web3Foreign, FOREIGN_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, upgradeProxy } = require('../deploymentUtils')
const {
  foreignContracts: {
    EternalStorageProxy,
    ForeignAMBErc677ToErc677,
    AbsoluteDailyLimit,
    RelativeExecutionDailyLimit
  }
} = require('../loadContracts')
const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  RELATIVE_DAILY_LIMIT
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
  const foreignBridgeImplementation = await deployContract(ForeignAMBErc677ToErc677, [], {
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
  console.log('\n[Foreign] Hooking up Mediator storage to Mediator implementation - Done')

  console.log('\n[Foreign] Deploying Limits Contracts')
  const LimitsContract = RELATIVE_DAILY_LIMIT ? RelativeExecutionDailyLimit : AbsoluteDailyLimit
  const limitsContract = await deployContract(LimitsContract, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  console.log('[Foreign] Limits Contract: ', limitsContract.options.address)

  console.log('\nForeign part of ERC677-to-ERC677 bridge deployed\n')
  return {
    foreignBridgeMediator: { address: foreignBridgeStorage.options.address },
    foreignLimitsContract: { address: limitsContract.options.address }
  }
}

module.exports = deployForeign

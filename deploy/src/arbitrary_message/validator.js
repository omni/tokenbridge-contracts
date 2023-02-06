const env = require('../loadEnv')
const {
  deployContract,
  privateKeyToAddress,
} = require('../deploymentUtils')
const { web3Home } = require('../web3')
const { homeContracts: { TelepathyHomeValidator } } = require('../loadContracts')
const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployTelepathyHomeValidator() {
  console.log('========================================')
  console.log('Deploying Telepathy Home Validator')
  console.log('========================================\n')
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const telepathyForeignApprover = await deployContract(TelepathyHomeValidator, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce
  })
  console.log('Telepathy Home Validator', telepathyForeignApprover.options.address)
}

module.exports = deployTelepathyHomeValidator
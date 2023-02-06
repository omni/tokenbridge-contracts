const env = require('../loadEnv')
const {
  deployContract,
  privateKeyToAddress,
} = require('../deploymentUtils')
const { web3Home } = require('../web3')
const { homeContracts: { TelepathyForeignApprover } } = require('../loadContracts')
const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployTelepathyForeignApprover() {
  console.log('========================================')
  console.log('Deploying Telepathy Foreign Approver')
  console.log('========================================\n')
  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const telepathyForeignApprover = await deployContract(TelepathyForeignApprover, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce
  })
  console.log('Telepathy Foreign Approver', telepathyForeignApprover.options.address)
}

module.exports = deployTelepathyForeignApprover
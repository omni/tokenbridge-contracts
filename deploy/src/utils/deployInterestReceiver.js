const env = require('../loadEnv')

const { deployContract, privateKeyToAddress } = require('../deploymentUtils')
const { web3Foreign } = require('../web3')

const {
  foreignContracts: { InterestReceiver }
} = require('../loadContracts')

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY, FOREIGN_INTEREST_RECEIVER_OWNER } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployInterestReceiver() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n[Foreign] deploying Interest receiver contract, setting owner to ', FOREIGN_INTEREST_RECEIVER_OWNER)
  const interestReceiver = await deployContract(InterestReceiver, [FOREIGN_INTEREST_RECEIVER_OWNER], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] Interest receiver: ', interestReceiver.options.address)
  console.log('\nInterest receiver deployment is completed\n')
  return {
    interestReceiverAddress: interestReceiver.options.address
  }
}
module.exports = deployInterestReceiver

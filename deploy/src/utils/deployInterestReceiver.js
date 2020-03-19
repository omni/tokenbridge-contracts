const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const {
  foreignContracts: { InterestReceiver }
} = require('../loadContracts')

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY, FOREIGN_INTEREST_RECEIVER_OWNER } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployInterestReceiver() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n[Foreign] deploying Interest receiver contract')
  const interestReceiver = await deployContract(InterestReceiver, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })
  foreignNonce++
  console.log('[Foreign] Interest receiver: ', interestReceiver.options.address)

  console.log('[Foreign] initializing contract owner to ', FOREIGN_INTEREST_RECEIVER_OWNER)
  const initializeData = await interestReceiver.methods
    .initialize(FOREIGN_INTEREST_RECEIVER_OWNER)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txInitialize = await sendRawTxForeign({
    data: initializeData,
    nonce: foreignNonce,
    to: interestReceiver.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.strictEqual(Web3Utils.hexToNumber(txInitialize.status), 1, 'Transaction Failed')

  console.log('\nInterest receiver deployment is completed\n')
  return {
    interestReceiverAddress: interestReceiver.options.address
  }
}
module.exports = deployInterestReceiver

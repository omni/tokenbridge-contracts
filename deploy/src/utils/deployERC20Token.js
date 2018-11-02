const assert = require('assert')
const Web3Utils = require('web3-utils')
const env = require('../loadEnv')

const { deployContract, privateKeyToAddress, sendRawTxForeign } = require('../deploymentUtils')
const { web3Foreign, deploymentPrivateKey, FOREIGN_RPC_URL } = require('../web3')

const ERC677BridgeToken = require('../../../build/contracts/ERC677BridgeToken.json')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  BRIDGEABLE_TOKEN_NAME,
  BRIDGEABLE_TOKEN_SYMBOL,
  BRIDGEABLE_TOKEN_DECIMALS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployToken() {
  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  console.log('\n[Foreign] deploying ERC20 token')
  const erc677token = await deployContract(
    ERC677BridgeToken,
    [BRIDGEABLE_TOKEN_NAME, BRIDGEABLE_TOKEN_SYMBOL, BRIDGEABLE_TOKEN_DECIMALS],
    { from: DEPLOYMENT_ACCOUNT_ADDRESS, network: 'foreign', nonce: foreignNonce }
  )
  foreignNonce++
  console.log('[Foreign] ERC20 Token: ', erc677token.options.address)

  console.log('[Foreign] minting 100 tokens and transfer them to ', DEPLOYMENT_ACCOUNT_ADDRESS)
  const mintData = await erc677token.methods
    .mint(DEPLOYMENT_ACCOUNT_ADDRESS, '100000000000000000000')
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const txMint = await sendRawTxForeign({
    data: mintData,
    nonce: foreignNonce,
    to: erc677token.options.address,
    privateKey: deploymentPrivateKey,
    url: FOREIGN_RPC_URL
  })
  assert.equal(Web3Utils.hexToNumber(txMint.status), 1, 'Transaction Failed')

  console.log('\nToken deployment is completed\n')
  return {
    erc677tokenAddress: erc677token.options.address,
  }
}
module.exports = deployToken

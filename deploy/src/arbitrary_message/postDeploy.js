const assert = require('assert')
const Web3Utils = require('web3-utils')

const env = require('../loadEnv')
const {
  deployContract,
  privateKeyToAddress,
  sendRawTxHome,
  upgradeProxy,
  initializeValidators,
  transferProxyOwnership,
  assertStateWithRetry
} = require('../deploymentUtils')
const { web3Home, web3Foreign, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')

const {
  homeContracts: { HomeAMB: HomeBridge, ForeignAMB: ForeignBridge }
} = require('../loadContracts')

const VALIDATORS = env.VALIDATORS.split(' ')

const {
  DEPLOYMENT_ACCOUNT_PRIVATE_KEY,
  REQUIRED_NUMBER_OF_VALIDATORS,
  HOME_GAS_PRICE,
  HOME_BRIDGE_OWNER,
  HOME_VALIDATORS_OWNER,
  HOME_UPGRADEABLE_ADMIN,
  HOME_MAX_AMOUNT_PER_TX,
  HOME_REQUIRED_BLOCK_CONFIRMATIONS
} = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function executeTransactions({ bridge, initialNonce, homeSuccinctAddress, foreignAMBAddress }) {
  let nonce = initialNonce

  const setSuccinctData = await bridge.methods
    .setSuccinctAMBAddress(homeSuccinctAddress)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  console.log(setSuccinctData)
  console.log(bridge.options.address)
  const setSuccinctTx = await sendRawTxHome({
    data: setSuccinctData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  if (setSuccinctTx.status) {
    assert.strictEqual(Web3Utils.hexToNumber(setSuccinctTx.status), 1, 'Transaction Failed')
  } else {
    console.log('Transaction failed')
    // await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  nonce++
  const setOtherAMBData = await bridge.methods
    .setOtherSideAMBAddress(foreignAMBAddress)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const setOtherAMBTx = await sendRawTxHome({
    data: setOtherAMBData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL
  })
  if (setOtherAMBTx.status) {
    assert.strictEqual(Web3Utils.hexToNumber(setOtherAMBTx.status), 1, 'Transaction Failed')
  } else {
    console.log('Transaction failed')
    // await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  return nonce
}

async function main() {
  console.log('========================================')
  console.log('Running post-deployment')
  console.log('========================================\n')

  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const homeBridge = new web3Home.eth.Contract(HomeBridge.abi, { from: DEPLOYMENT_ACCOUNT_ADDRESS })
  const GOERLI_SUCCINCT_ADDRESS = '0x68787ab0Ca5A4a8CC82177B4E4f206765Ce39956'
  const GNOSIS_SUCCINCT_ADDRESS = '0x11f4B338c6127F0939d3D7CD56b1C9e6c4a68725'
  const FOREIGN_TOKENBRIDGE_AMB = '0x977045fae74e6DD5BEE28F6423984D6a9a4045F3' // On Goerli
  const HOME_TOKENBRIDGE_AMB = '0x8EF21b3F8eFD9d90689518F1A67a6E6bE75Ec766' // on Gnosis
  homeBridge.options.address = HOME_TOKENBRIDGE_AMB
  await executeTransactions({
    bridge: homeBridge,
    initialNonce: nonce,
    homeSuccinctAddress: GNOSIS_SUCCINCT_ADDRESS,
    foreignAMBAddress: FOREIGN_TOKENBRIDGE_AMB
  })

  //   function requireToPassMessage(address _contract, bytes memory _data, uint256 _gas) public returns (bytes32) {
}

main()

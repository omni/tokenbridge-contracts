const assert = require('assert')
const Web3Utils = require('web3-utils')

const env = require('../loadEnv')
const { privateKeyToAddress, sendRawTxHome } = require('../deploymentUtils')
const { web3Home, web3Foreign, deploymentPrivateKey, HOME_RPC_URL, FOREIGN_RPC_URL } = require('../web3')

const {
  homeContracts: { HomeAMB: HomeBridge, ForeignAMB: ForeignBridge }
} = require('../loadContracts')

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function executeTransactions({ bridge, initialNonce, succinctAddress, otherAMBAddress, RPC_URL }) {
  let nonce = initialNonce

  const setSuccinctData = await bridge.methods
    .setSuccinctAMBAddress(succinctAddress)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  console.log('Setting Succinct Address')
  const setSuccinctTx = await sendRawTxHome({
    data: setSuccinctData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: RPC_URL
  })
  if (setSuccinctTx.status) {
    assert.strictEqual(Web3Utils.hexToNumber(setSuccinctTx.status), 1, 'Transaction Failed')
  } else {
    console.log('Transaction failed')
    // await assertStateWithRetry(bridge.methods.isInitialized().call, true)
  }
  nonce++
  const setOtherAMBData = await bridge.methods
    .setOtherSideAMBAddress(otherAMBAddress)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })
  console.log('Setting other side AMB address')
  const setOtherAMBTx = await sendRawTxHome({
    data: setOtherAMBData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: RPC_URL
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
  console.log('Running post-deployment setting of variables')
  console.log('========================================\n')

  const FOREIGN_SUCCINCT_ADDRESS = '0x68787ab0Ca5A4a8CC82177B4E4f206765Ce39956' // On Goerli
  const HOME_SUCCINCT_ADDRESS = '0x11f4B338c6127F0939d3D7CD56b1C9e6c4a68725' // On Gnosis
  // This can be gotten from deploy/bridgeDeploymentResults.json
  const FOREIGN_TOKENBRIDGE_AMB = '0x977045fae74e6DD5BEE28F6423984D6a9a4045F3' // On Goerli
  const HOME_TOKENBRIDGE_AMB = '0x8EF21b3F8eFD9d90689518F1A67a6E6bE75Ec766' // on Gnosis

  let nonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const homeBridge = new web3Home.eth.Contract(HomeBridge.abi, { from: DEPLOYMENT_ACCOUNT_ADDRESS })
  homeBridge.options.address = HOME_TOKENBRIDGE_AMB
  console.log('Setting up addresses for home AMB')
  await executeTransactions({
    bridge: homeBridge,
    initialNonce: nonce,
    succinctAddress: HOME_SUCCINCT_ADDRESS,
    otherAMBAddress: FOREIGN_TOKENBRIDGE_AMB,
    RPC_URL: HOME_RPC_URL
  })

  let foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const foreignBridge = new web3Foreign.eth.Contract(ForeignBridge.abi, { from: DEPLOYMENT_ACCOUNT_ADDRESS })
  foreignBridge.options.address = FOREIGN_TOKENBRIDGE_AMB
  console.log('Setting up addresses for foreign AMB')
  await executeTransactions({
    bridge: foreignBridge,
    initialNonce: foreignNonce,
    succinctAddress: FOREIGN_SUCCINCT_ADDRESS,
    otherAMBAddress: HOME_TOKENBRIDGE_AMB,
    RPC_URL: FOREIGN_RPC_URL
  })
}

main()

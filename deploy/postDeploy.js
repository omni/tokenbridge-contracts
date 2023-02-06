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
  console.log({
    data: setSuccinctData,
    nonce,
    to: bridge.options.address,
    privateKey: deploymentPrivateKey,
    url: RPC_URL
  })
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
  console.log('============================================')
  console.log('Running post-deployment setting of variables')
  console.log('============================================\n')

  const SUCCINCT_HOME_SOURCE_AMB_ADDRESS = '0xd667A279A51fE457f934A5c487FC490B91A77d1a';
  const SUCCINCT_HOME_TARGET_AMB_ADDRESS = '0xef604f14B99a37bf88F239C85A8826AeB2D9D699';
  const SUCCINCT_FOREIGN_SOURCE_AMB_ADDRESS = '0x39323dC5A276553EF7fD16Ed3164175747eB254c';
  const SUCCINCT_FOREIGN_TARGET_AMB_ADDRESS = '0xbc394A38fD6a76F254d14886bCe053279eAffB46';

  const HOME_TOKENBRIDGE_AMB = '0xFc8D4E3C19B42A9a1cb3B79f925e2382555ceE67' 
  const FOREIGN_TOKENBRIDGE_AMB = '0x058C1b0Cb334fEb31BcAb58e8f967d083eddf1be'

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
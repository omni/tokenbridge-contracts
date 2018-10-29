const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')
const { privateKeyToAddress, sendRawTxHome } = require('../deploymentUtils')
const HomeBridge = require('../../../build/contracts/HomeBridgeErcToNative.json')
const env = require('../loadEnv')

const { BLOCK_REWARD_ADDRESS, DEPLOYMENT_ACCOUNT_PRIVATE_KEY, HOME_BRIDGE_ADDRESS } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function setBlockReward() {
  const homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)

  const homeBridge = new web3Home.eth.Contract(HomeBridge.abi, HOME_BRIDGE_ADDRESS)

  const setBlockRewardAddressData = await homeBridge.methods
    .setBlockRewardContract(BLOCK_REWARD_ADDRESS)
    .encodeABI({ from: DEPLOYMENT_ACCOUNT_ADDRESS })

  await sendRawTxHome({
    data: setBlockRewardAddressData,
    to: homeBridge.options.address,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL,
    nonce: homeNonce
  })
}

setBlockReward().catch(console.error)

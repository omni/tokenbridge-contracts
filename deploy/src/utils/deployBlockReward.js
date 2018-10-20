const Web3Utils = require('web3-utils')
const { web3Home, deploymentPrivateKey, HOME_RPC_URL } = require('../web3')
const { deployContract, privateKeyToAddress, sendRawTxHome } = require('../deploymentUtils')
const BlockReward = require('../../../build/contracts/BlockReward.json')
const env = require('../loadEnv')

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployBlockReward() {
  let homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const blockReward = await deployContract(BlockReward, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })
  homeNonce++

  const blockRewardAddress = blockReward.options.address

  await sendRawTxHome({
    to: blockRewardAddress,
    privateKey: deploymentPrivateKey,
    url: HOME_RPC_URL,
    value: Web3Utils.toHex(Web3Utils.toWei('1000')),
    nonce: homeNonce
  })

  console.log(blockRewardAddress)
}

deployBlockReward().catch(console.error)

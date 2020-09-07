const { web3Home, web3Foreign } = require('../web3')
const { deployContract, privateKeyToAddress } = require('../deploymentUtils')
const Box = require('../../../contracts/build/contracts/Box')
const env = require('../loadEnv')

const { DEPLOYMENT_ACCOUNT_PRIVATE_KEY } = env

const DEPLOYMENT_ACCOUNT_ADDRESS = privateKeyToAddress(DEPLOYMENT_ACCOUNT_PRIVATE_KEY)

async function deployTestBox() {
  const homeNonce = await web3Home.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const homeBoxContract = await deployContract(Box, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'home',
    nonce: homeNonce
  })

  const foreignNonce = await web3Foreign.eth.getTransactionCount(DEPLOYMENT_ACCOUNT_ADDRESS)
  const foreignBoxContract = await deployContract(Box, [], {
    from: DEPLOYMENT_ACCOUNT_ADDRESS,
    network: 'foreign',
    nonce: foreignNonce
  })

  console.log(`Home Box Address: ${homeBoxContract.options.address}`)
  console.log(`Foreign Box Address: ${foreignBoxContract.options.address}`)
}

deployTestBox().catch(console.error)
